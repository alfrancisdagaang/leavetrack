import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { createLeaveRequest } from "@/lib/leave/service";

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

/** A fake postgres.js client: records every statement and answers the ones submit makes. */
function fakeSql(balances: { leave_type_id: string; balance: string }[]) {
  const calls: Call[] = [];
  const tx = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    calls.push({ text, values });
    let rows: unknown[] = [];
    if (/^select id, manager_id from public\.users/.test(text)) {
      rows = [{ id: ELENA, manager_id: MARCO }];
    } else if (/^select id, name, tracks_balance from public\.leave_types/.test(text)) {
      rows = TYPES;
    } else if (/^select leave_type_id, balance from public\.leave_balances/.test(text)) {
      rows = balances;
    } else if (/from public\.leave_requests where user_id/.test(text)) {
      rows = [];
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
  const sql = { begin: (cb: (t: typeof tx) => Promise<unknown>) => cb(tx) } as unknown as Sql;
  const touched = (re: RegExp) => calls.filter((c) => re.test(c.text));
  return { sql, touched };
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
