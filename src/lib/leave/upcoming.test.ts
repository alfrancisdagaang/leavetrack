import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { getUpcomingLeave, UPCOMING_LIMIT, type UpcomingQuery } from "@/lib/leave/upcoming";

const MARCO = "00000000-0000-4000-8000-000000000002";
const TODAY = "2026-10-15";

type Call = { text: string; values: unknown[] };

/** A fake postgres.js client: records the statement and answers with the rows given. */
function fakeSql(rows: unknown[] = []) {
  const calls: Call[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
    return Promise.resolve(rows);
  }) as unknown as Sql;
  return { sql, calls };
}

const query = (over: Partial<UpcomingQuery>): UpcomingQuery => ({
  role: "employee",
  userId: MARCO,
  today: TODAY,
  ...over,
});

describe("getUpcomingLeave: scope lives in the SQL (AGENTS.md rule 3)", () => {
  it("AC1 employee: only their own requests, no manager join, the session id is the only id", async () => {
    const { sql, calls } = fakeSql();
    await getUpcomingLeave(sql, query({ role: "employee" }));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain("where r.user_id = ?");
    expect(calls[0]?.text).not.toContain("manager_id");
    expect(calls[0]?.values).toEqual([MARCO, TODAY, UPCOMING_LIMIT]);
  });

  it("AC2 manager: their own plus their direct reports, filtered with u.manager_id in the query", async () => {
    const { sql, calls } = fakeSql();
    await getUpcomingLeave(sql, query({ role: "manager" }));
    expect(calls[0]?.text).toContain("(r.user_id = ? or u.manager_id = ?)");
    expect(calls[0]?.values).toEqual([MARCO, MARCO, TODAY, UPCOMING_LIMIT]);
  });

  it("AC3 hr_admin: everyone, so no user or manager filter at all", async () => {
    const { sql, calls } = fakeSql();
    await getUpcomingLeave(sql, query({ role: "hr_admin" }));
    expect(calls[0]?.text).not.toContain("r.user_id = ?");
    expect(calls[0]?.text).not.toContain("manager_id = ?");
    expect(calls[0]?.values).toEqual([TODAY, UPCOMING_LIMIT]);
  });

  it.each(["employee", "manager", "hr_admin"] as const)(
    "AC4 %s: pending and approved only, never deleted, not ended, soonest first, limited",
    async (role) => {
      const { sql, calls } = fakeSql();
      await getUpcomingLeave(sql, query({ role }));
      const text = calls[0]?.text ?? "";
      expect(text).toContain("r.is_deleted = false");
      expect(text).toContain("r.status in ('pending', 'approved')");
      expect(text).not.toContain("rejected");
      expect(text).toContain("r.end_date >= ?::date");
      expect(text).toContain("order by r.start_date, r.id limit ?");
      expect(text).toContain("r.start_date::text as start_date");
    },
  );

  it("maps rows to the view shape", async () => {
    const { sql } = fakeSql([
      {
        id: "r1",
        user_id: "u1",
        user_name: "Priya Shah",
        leave_type_name: "Vacation",
        start_date: "2026-10-19",
        end_date: "2026-10-21",
        status: "pending",
      },
    ]);
    expect(await getUpcomingLeave(sql, query({ role: "hr_admin" }))).toEqual([
      {
        id: "r1",
        userId: "u1",
        userName: "Priya Shah",
        leaveTypeName: "Vacation",
        startDate: "2026-10-19",
        endDate: "2026-10-21",
        status: "pending",
      },
    ]);
  });
});
