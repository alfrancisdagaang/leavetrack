import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import {
  getOverrideQueue,
  getRecentOverrides,
  OVERRIDE_QUEUE_LIMIT,
  RECENT_OVERRIDES_LIMIT,
} from "@/lib/leave/override-queue";

const HR = "00000000-0000-4000-8000-000000000001";

type Call = { text: string; values: unknown[] };

/** A fake postgres.js client: records the statement and answers with `rows`. */
function fakeSql(rows: unknown[]) {
  const calls: Call[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
    return Promise.resolve(rows);
  }) as unknown as Sql;
  return { sql, calls };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  employee_name: "Elena Cruz",
  manager_name: "Marco Santos",
  leave_type_name: "Vacation",
  start_date: "2026-11-02",
  end_date: "2026-11-06",
  reason: "Family trip",
  created_at: new Date("2026-10-18T00:00:00Z"),
  working_days: 5,
  balance: "2.00",
  shortfall: "3.00",
  total: 7,
  ...over,
});

describe("getOverrideQueue", () => {
  it("is one statement, scoped by role-side conditions in the SQL and not by a team", async () => {
    const { sql, calls } = fakeSql([]);
    await getOverrideQueue(sql, HR);
    expect(calls).toHaveLength(1);
    const { text, values } = calls[0]!;
    expect(text).toContain("r.status = 'pending'");
    expect(text).toContain("r.is_deleted = false");
    expect(text).toContain("r.user_id <> ?");
    expect(text).toContain("lt.tracks_balance");
    expect(text).toContain("lb.balance >= 0 and lb.balance < d.days");
    expect(text).toContain("isodow");
    expect(text).toContain("order by r.created_at, r.id");
    expect(text).not.toContain("manager_id =");
    expect(values).toEqual([HR, OVERRIDE_QUEUE_LIMIT]);
    expect(OVERRIDE_QUEUE_LIMIT).toBe(50);
  });

  it("selects the employee's reason only because every row is a pending request", async () => {
    const { sql, calls } = fakeSql([]);
    await getOverrideQueue(sql, HR);
    expect(calls[0]!.text).toContain("r.reason");
    expect(calls[0]!.text).toContain("r.status = 'pending'");
  });

  it("returns the rows without the window total, and the total separately", async () => {
    const { sql } = fakeSql([row(), row({ id: "r2", total: 7 })]);
    const queue = await getOverrideQueue(sql, HR);
    expect(queue.total).toBe(7);
    expect(queue.rows.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(queue.rows[0]).not.toHaveProperty("total");
    expect(queue.rows[0]).toMatchObject({ balance: "2.00", shortfall: "3.00", working_days: 5 });
  });

  it("an empty queue has a total of 0", async () => {
    const { sql } = fakeSql([]);
    expect(await getOverrideQueue(sql, HR)).toEqual({ rows: [], total: 0 });
  });
});

describe("getRecentOverrides", () => {
  it("is one statement over override_approved audit rows, newest first, capped, with no reason", async () => {
    const { sql, calls } = fakeSql([]);
    await getRecentOverrides(sql);
    expect(calls).toHaveLength(1);
    const { text, values } = calls[0]!;
    expect(text).toContain("a.action = 'override_approved'");
    expect(text).toContain("order by a.occurred_at desc, a.id desc");
    expect(text).not.toContain("r.reason");
    expect(text).not.toContain("decision_note");
    expect(values).toEqual([RECENT_OVERRIDES_LIMIT]);
    expect(RECENT_OVERRIDES_LIMIT).toBe(10);
  });
});
