import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { getRecentlyDecided, getTeamQueue } from "@/lib/leave/team";

const MARCO = "00000000-0000-4000-8000-000000000002";

function fakeSql(rows: unknown[]) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
    return Promise.resolve(rows);
  }) as unknown as Sql;
  return { sql, calls };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  employee_name: "Elena Cruz",
  leave_type_id: "t-vac",
  leave_type_name: "Vacation",
  tracks_balance: true,
  start_date: "2026-11-02", // Mon
  end_date: "2026-11-04", // Wed: 3 working days
  reason: "",
  status: "pending",
  created_at: new Date("2026-10-14T00:00:00Z"),
  balance: "10.00",
  ...over,
});

describe("getTeamQueue", () => {
  it("US-04 AC1: the manager scope is part of the SQL, bound to the caller's id", async () => {
    const { sql, calls } = fakeSql([]);
    await getTeamQueue(sql, MARCO);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain("where u.manager_id = ?");
    expect(calls[0]?.text).toContain("r.status = 'pending'");
    expect(calls[0]?.text).toContain("r.is_deleted = false");
    expect(calls[0]?.values).toEqual([MARCO]);
  });

  it("returns exactly the rows the database gives it (no filtering in TypeScript)", async () => {
    const rows = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })];
    const { sql } = fakeSql(rows);
    expect((await getTeamQueue(sql, MARCO)).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("US-04 AC2: scope is read live from users.manager_id, not stored on the request", async () => {
    const { sql, calls } = fakeSql([]);
    await getTeamQueue(sql, MARCO);
    expect(calls[0]?.text).toContain("join public.users u on u.id = r.user_id");
    expect(calls[0]?.text).not.toMatch(/r\.manager_id|r\.approver/);
  });

  it("works out working days and flags a request the balance cannot cover", async () => {
    const { sql } = fakeSql([
      row({ id: "ok", balance: "3.00" }), // exactly enough
      row({ id: "short", balance: "2.00" }),
      row({ id: "missing", balance: null }),
    ]);
    const [ok, short, missing] = await getTeamQueue(sql, MARCO);
    expect(ok).toMatchObject({ working_days: 3, balance: 3, insufficient: false });
    expect(short).toMatchObject({ balance: 2, insufficient: true });
    expect(missing).toMatchObject({ balance: null, insufficient: true });
  });

  it("never flags Unpaid (no balance is tracked)", async () => {
    const { sql } = fakeSql([
      row({ leave_type_name: "Unpaid", tracks_balance: false, balance: null }),
    ]);
    const [unpaid] = await getTeamQueue(sql, MARCO);
    expect(unpaid).toMatchObject({ balance: null, insufficient: false });
  });
});

describe("getRecentlyDecided", () => {
  it("is scoped in SQL to the caller's direct reports, excludes pending and soft-deleted, and is capped", async () => {
    const { sql, calls } = fakeSql([]);
    await getRecentlyDecided(sql, MARCO);
    expect(calls[0]?.text).toContain("where u.manager_id = ?");
    expect(calls[0]?.text).toContain("r.status <> 'pending'");
    expect(calls[0]?.text).toContain("r.is_deleted = false");
    expect(calls[0]?.text).toContain("limit 10");
    expect(calls[0]?.values).toEqual([MARCO]);
  });

  it("adds working days to each row", async () => {
    const { sql } = fakeSql([
      {
        id: "r1",
        employee_name: "Elena Cruz",
        leave_type_name: "Vacation",
        start_date: "2026-11-02",
        end_date: "2026-11-04",
        status: "rejected",
        decision_note: "Team is short",
        decided_at: new Date(),
      },
    ]);
    const [first] = await getRecentlyDecided(sql, MARCO);
    expect(first).toMatchObject({ working_days: 3, decision_note: "Team is short" });
  });
});
