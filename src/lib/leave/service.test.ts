import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import {
  createLeaveRequest,
  getBalanceSummary,
  getDashboardSummary,
  getMySummary,
} from "@/lib/leave/service";

const ELENA = "00000000-0000-4000-8000-000000000003";
const MARCO = "00000000-0000-4000-8000-000000000002";
const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const UNPAID = "10000000-0000-4000-8000-000000000003";

type Call = { text: string; values: unknown[] };

const TYPES = [
  { id: VAC, name: "Vacation", tracks_balance: true },
  { id: SICK, name: "Sick", tracks_balance: true },
  { id: UNPAID, name: "Unpaid", tracks_balance: false },
];

type Pending = { leave_type_id: string; start_date: string; end_date: string };

/**
 * A fake postgres.js client: records every statement and answers the ones these functions make.
 * The balance summary is ONE statement that returns its three parts as JSON columns.
 */
function fakeSql(
  balances: { leave_type_id: string; balance: string }[],
  { pending = [], approvals = 0 }: { pending?: Pending[]; approvals?: number } = {},
) {
  const calls: Call[] = [];
  const tx = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    calls.push({ text, values });
    let rows: unknown[] = [];
    if (/^select id, manager_id from public\.users/.test(text)) {
      rows = [{ id: ELENA, manager_id: MARCO }];
    } else if (/json_agg\(.*public\.leave_types/.test(text)) {
      rows = [
        {
          types: TYPES,
          balances,
          pending,
          pending_approvals: values[2] === true ? approvals : null,
        },
      ];
    } else if (/^insert into public\.leave_requests/.test(text)) {
      rows = [
        {
          id: "30000000-0000-4000-8000-000000000001",
          leave_type_id: values[1],
          start_date: values[2],
          end_date: values[3],
          reason: values[4],
          status: "pending",
          created_at: new Date(),
          decided_at: null,
          decision_note: null,
        },
      ];
    }
    return Promise.resolve(rows);
  };
  const sql = Object.assign(tx, {
    begin: (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
  }) as unknown as Sql;
  const touched = (re: RegExp) => calls.filter((c) => re.test(c.text));
  return { sql, touched, calls };
}

// Mon 2026-11-02 to Fri 2026-11-06 is 5 working days.
const input = (leave_type_id: string) => ({
  leave_type_id,
  start_date: "2026-11-02",
  end_date: "2026-11-06",
  reason: "",
});

describe("createLeaveRequest (US-08 AC2: submit is never blocked by a balance)", () => {
  it("Unpaid with no balance row is accepted, with no warning, a pending row and a submitted audit row", async () => {
    const { sql, touched } = fakeSql([]);
    const result = await createLeaveRequest(sql, ELENA, input(UNPAID));

    expect(result.warnings).toEqual([]);
    expect(result.request.status).toBe("pending");
    expect(touched(/^insert into public\.leave_requests/)).toHaveLength(1);
    expect(touched(/^insert into public\.audit_log/)).toHaveLength(1);
  });

  it("Unpaid is accepted even when every tracked balance is zero", async () => {
    const { sql } = fakeSql([
      { leave_type_id: VAC, balance: "0.00" },
      { leave_type_id: SICK, balance: "0.00" },
    ]);
    const result = await createLeaveRequest(sql, ELENA, input(UNPAID));
    expect(result.warnings).toEqual([]);
  });

  it("a tracked type over its balance is still accepted; it only carries a warning", async () => {
    const { sql, touched } = fakeSql([{ leave_type_id: SICK, balance: "1.00" }]);
    const result = await createLeaveRequest(sql, ELENA, input(SICK));

    expect(result.warnings).toHaveLength(1);
    expect(touched(/^insert into public\.leave_requests/)).toHaveLength(1);
  });

  it("an unknown leave type is a validation error and nothing is inserted", async () => {
    const { sql, touched } = fakeSql([]);
    const unknown = "10000000-0000-4000-8000-0000000000ff";
    await expect(createLeaveRequest(sql, ELENA, input(unknown))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(touched(/^insert into/)).toHaveLength(0);
  });
});

describe("balance summary reads (pool budget: one statement per summary)", () => {
  const SUMMARY = /json_agg\(.*public\.leave_types/;

  it("getBalanceSummary issues exactly one statement and shapes it as before", async () => {
    const { sql, calls } = fakeSql([{ leave_type_id: VAC, balance: "10.00" }], {
      pending: [{ leave_type_id: VAC, start_date: "2026-11-02", end_date: "2026-11-03" }],
    });
    const summary = await getBalanceSummary(sql, ELENA);

    expect(calls).toHaveLength(1);
    expect(summary.map((s) => s.leaveTypeName)).toEqual(["Vacation", "Sick", "Unpaid"]);
    expect(summary[0]).toMatchObject({ confirmed: 10, pending: 2, available: 8 });
    expect(summary[1]).toMatchObject({ confirmed: 0, pending: 0, available: 0 });
    expect(summary[2]).toMatchObject({ tracksBalance: false, confirmed: null, available: null });
  });

  it("getMySummary issues exactly two statements: the request list and the summary", async () => {
    const { sql, calls } = fakeSql([]);
    await getMySummary(sql, ELENA);
    expect(calls).toHaveLength(2);
    expect(calls.filter((c) => SUMMARY.test(c.text))).toHaveLength(1);
  });

  it("filters by the given user id in SQL, never fetching broadly", async () => {
    const { sql, calls } = fakeSql([]);
    await getBalanceSummary(sql, ELENA);
    expect(calls[0]?.text).toMatch(/b\.user_id = \?/);
    expect(calls[0]?.text).toMatch(/r\.user_id = \?/);
    expect(calls[0]?.values.filter((v) => v === ELENA)).toHaveLength(3);
  });

  it("getDashboardSummary counts approvals for an approver, scoped by manager_id in SQL", async () => {
    const { sql, calls } = fakeSql([], { approvals: 3 });
    const result = await getDashboardSummary(sql, MARCO, true);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toMatch(/u\.manager_id = \?/);
    expect(calls[0]?.values).toEqual([MARCO, MARCO, true, MARCO]);
    expect(result.pendingApprovals).toBe(3);
  });

  it("getDashboardSummary leaves the approvals count null for an employee", async () => {
    const { sql, calls } = fakeSql([], { approvals: 3 });
    const result = await getDashboardSummary(sql, ELENA, false);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.values[2]).toBe(false);
    expect(result.pendingApprovals).toBeNull();
  });
});
