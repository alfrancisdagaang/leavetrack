import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import {
  createLeaveRequest,
  getBalancePage,
  getBalanceSummary,
  getDashboardSummary,
  getMySummary,
} from "@/lib/leave/service";
import { yearBounds } from "@/lib/leave/breakdown";

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
  {
    pending = [],
    approvals = 0,
    used = [],
    accrued = [],
  }: {
    pending?: Pending[];
    approvals?: number;
    used?: Pending[];
    accrued?: { leave_type_id: string; amount: string }[];
  } = {},
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
          used,
          accrued,
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

describe("My Balance page read (pool budget: one statement for the breakdown)", () => {
  const YEAR = yearBounds("2026-10-18");
  const BREAKDOWN = /json_agg\(.*public\.accrual_ledger/;

  it("getBalancePage issues exactly two statements: the request list and the breakdown", async () => {
    const { sql, calls } = fakeSql([]);
    await getBalancePage(sql, ELENA, YEAR);
    expect(calls).toHaveLength(2);
    expect(calls.filter((c) => BREAKDOWN.test(c.text))).toHaveLength(1);
  });

  it("TASK-040: the request list asks, in the same statement, which approvals were HR overrides", async () => {
    const { sql, calls } = fakeSql([]);
    await getBalancePage(sql, ELENA, YEAR);
    const list = calls.find((c) =>
      /from public\.leave_requests r where r\.user_id = \?/.test(c.text),
    )!;
    expect(list.text).toContain("a.action = 'override_approved'");
    expect(list.text).toContain("as overridden");
    expect(list.values).toEqual([ELENA]);
  });

  it("B9: every user-scoped part filters by the given user id in SQL", async () => {
    const { sql, calls } = fakeSql([]);
    await getBalancePage(sql, ELENA, YEAR);
    const call = calls.find((c) => BREAKDOWN.test(c.text))!;
    for (const scoped of ["b.user_id = ?", "r.user_id = ?", "u.user_id = ?", "l.user_id = ?"]) {
      expect(call.text).toContain(scoped);
    }
    expect(call.values.filter((v) => v === ELENA)).toHaveLength(4);
    expect(call.values.filter((v) => v === YEAR.from)).toHaveLength(3);
    expect(call.values.filter((v) => v === YEAR.to)).toHaveLength(3);
  });

  it("B3: used reads only approved, non-deleted requests; pending reads only pending", async () => {
    const { sql, calls } = fakeSql([]);
    await getBalancePage(sql, ELENA, YEAR);
    const text = calls.find((c) => BREAKDOWN.test(c.text))!.text;
    expect(text).toMatch(/u\.status = 'approved' and u\.is_deleted = false/);
    expect(text).toMatch(/r\.status = 'pending' and r\.is_deleted = false/);
  });

  it("B4: the year clips the range in SQL and the weekdays are counted by countWorkingDays", async () => {
    const { sql, calls } = fakeSql([{ leave_type_id: VAC, balance: "10.00" }], {
      used: [{ leave_type_id: VAC, start_date: "2026-12-29", end_date: "2026-12-31" }],
      accrued: [{ leave_type_id: VAC, amount: "2.50" }],
    });
    const page = await getBalancePage(sql, ELENA, YEAR);
    const text = calls.find((c) => BREAKDOWN.test(c.text))!.text;
    expect(text).toContain("greatest(u.start_date, ?::date)");
    expect(text).toContain("least(u.end_date, ?::date)");
    expect(page.balances[0]).toMatchObject({
      usedThisYear: 3,
      accruedThisYear: 2.5,
      openingBalance: 10.5, // 10 + 3 - 2.5
    });
  });

  it("B10: confirmed, pending and available equal getBalanceSummary's for the same data", async () => {
    const data = [{ leave_type_id: VAC, balance: "11.25" }];
    const pending = [{ leave_type_id: VAC, start_date: "2026-11-02", end_date: "2026-11-04" }];
    const old = await getBalanceSummary(fakeSql(data, { pending }).sql, ELENA);
    const page = await getBalancePage(fakeSql(data, { pending }).sql, ELENA, YEAR);
    expect(
      page.balances.map(({ usedThisYear: _u, accruedThisYear: _a, openingBalance: _o, ...r }) => r),
    ).toEqual(old);
  });

  it("B10: getMySummary still returns the old shape, with no breakdown fields (the API payload)", async () => {
    const { sql } = fakeSql([{ leave_type_id: VAC, balance: "10.00" }]);
    const result = await getMySummary(sql, ELENA);
    expect(Object.keys(result.balances[0] ?? {}).sort()).toEqual(
      ["available", "confirmed", "leaveTypeId", "leaveTypeName", "pending", "tracksBalance"].sort(),
    );
  });
});
