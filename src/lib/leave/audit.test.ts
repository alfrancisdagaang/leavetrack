import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { getAuditHistory, listEmployees } from "@/lib/leave/audit";

const ELENA = "00000000-0000-4000-8000-000000000003";
const NO_FILTER = { include_deleted: false } as const;

type Call = { text: string; values: unknown[] };

/** Fake postgres.js client: answers the employee lookup and the history query from a script. */
function fakeSql(script: { employee: unknown[]; requests?: unknown[]; list?: unknown[] }) {
  const calls: Call[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    calls.push({ text, values });
    if (/^select id, name, role from public\.users where id/.test(text)) {
      return Promise.resolve(script.employee);
    }
    if (/^select id, name, role from public\.users order by name/.test(text)) {
      return Promise.resolve(script.list ?? []);
    }
    return Promise.resolve(script.requests ?? []);
  }) as unknown as Sql;
  const history = () => calls.find((c) => c.text.includes("from public.leave_requests r"));
  return { sql, calls, history };
}

const employee = [{ id: ELENA, name: "Elena Cruz", role: "employee" }];

const row = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  leave_type_name: "Vacation",
  start_date: "2026-11-02", // Mon
  end_date: "2026-11-04", // Wed: 3 working days
  status: "approved",
  created_at: new Date("2026-10-14T07:06:00Z"),
  decided_by: "00000000-0000-4000-8000-000000000002",
  decided_by_name: "Marco Santos",
  decided_at: new Date("2026-10-15T01:00:00Z"),
  decision_note: null,
  is_deleted: false,
  events: [
    {
      action: "submitted",
      actor_id: ELENA,
      actor_name: "Elena Cruz",
      occurred_at: "2026-10-14T07:06:00+00:00",
    },
    {
      action: "approved",
      actor_id: "m",
      actor_name: "Marco Santos",
      occurred_at: "2026-10-15T01:00:00+00:00",
    },
  ],
  ...over,
});

describe("getAuditHistory", () => {
  it("US-05 AC1: reports every request of the employee with status, decision-maker and timestamps", async () => {
    const { sql } = fakeSql({
      employee,
      requests: [
        row(),
        row({
          id: "r2",
          status: "pending",
          decided_by: null,
          decided_by_name: null,
          decided_at: null,
        }),
      ],
    });

    const result = await getAuditHistory(sql, ELENA, NO_FILTER);

    expect(result.employee).toEqual(employee[0]);
    expect(result.requests.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(result.requests[0]).toMatchObject({
      status: "approved",
      decided_by_name: "Marco Santos",
      working_days: 3,
    });
    expect(result.requests[0]?.decided_at).toBeInstanceOf(Date);
    expect(result.requests[0]?.events.map((e) => e.action)).toEqual(["submitted", "approved"]);
    expect(result.requests[1]).toMatchObject({ decided_by: null, decided_at: null });
  });

  it("is scoped to the employee in the SQL and reads only", async () => {
    const { sql, history } = fakeSql({ employee, requests: [] });
    await getAuditHistory(sql, ELENA, NO_FILTER);
    expect(history()?.text).toContain("where r.user_id = ?");
    expect(history()?.values[0]).toBe(ELENA);
    expect(history()?.text).not.toMatch(/\b(insert|update|delete)\b/);
  });

  it("US-05 AC2: soft-deleted requests are hidden by default and included only on request", async () => {
    const hidden = fakeSql({ employee });
    await getAuditHistory(hidden.sql, ELENA, { include_deleted: false });
    const shown = fakeSql({ employee });
    await getAuditHistory(shown.sql, ELENA, { include_deleted: true });

    expect(hidden.history()?.text).toContain("(?::boolean or r.is_deleted = false)");
    expect(hidden.history()?.values[1]).toBe(false);
    expect(shown.history()?.values[1]).toBe(true);
  });

  it("never selects a deleted-row filter that cannot be switched off, and keeps deleted rows flagged", async () => {
    const { sql } = fakeSql({ employee, requests: [row({ is_deleted: true })] });
    const result = await getAuditHistory(sql, ELENA, { include_deleted: true });
    expect(result.requests[0]?.is_deleted).toBe(true);
  });

  it("has no time cutoff and no row cap, so nothing inside the 3-year retention is hidden", async () => {
    const { sql, history } = fakeSql({ employee });
    await getAuditHistory(sql, ELENA, NO_FILTER);
    const text = history()?.text ?? "";
    expect(text).not.toMatch(/interval|now\(\)|current_date|\blimit\b/i);
  });

  it("never reads the employee's free-text reason", async () => {
    const { sql, history } = fakeSql({ employee });
    await getAuditHistory(sql, ELENA, NO_FILTER);
    expect(history()?.text).not.toContain("r.reason");
  });

  it("passes no range as nulls, and a range as UTC-bounded parameters", async () => {
    // Parameters: user, include_deleted, then from/to for the "no range" test, then from, from, to, to.
    const none = fakeSql({ employee });
    await getAuditHistory(none.sql, ELENA, NO_FILTER);
    expect(none.history()?.values).toEqual([ELENA, false, null, null, null, null, null, null]);

    const ranged = fakeSql({ employee });
    await getAuditHistory(ranged.sql, ELENA, {
      from: "2026-10-01",
      to: "2026-10-31",
      include_deleted: false,
    });
    const F = "2026-10-01";
    const T = "2026-10-31";
    expect(ranged.history()?.values).toEqual([ELENA, false, F, T, F, F, T, T]);
    expect(ranged.history()?.text).toContain("at time zone 'UTC'");
  });

  it("an unknown employee is a 404 and the history is never queried", async () => {
    const { sql, history } = fakeSql({ employee: [] });
    await expect(getAuditHistory(sql, ELENA, NO_FILTER)).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
    expect(history()).toBeUndefined();
  });

  it("an employee with no requests gives an empty list, not an error", async () => {
    const { sql } = fakeSql({ employee, requests: [] });
    expect((await getAuditHistory(sql, ELENA, NO_FILTER)).requests).toEqual([]);
  });
});

describe("listEmployees", () => {
  it("returns id, name and role ordered by name", async () => {
    const list = [{ id: "a", name: "Ana", role: "manager" }];
    const { sql, calls } = fakeSql({ employee, list });
    expect(await listEmployees(sql)).toEqual(list);
    expect(calls[0]?.text).toContain("order by name");
  });
});
