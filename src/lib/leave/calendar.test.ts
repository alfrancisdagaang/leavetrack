import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { getCalendarRequests, type CalendarQuery } from "@/lib/leave/calendar";

const MARCO = "00000000-0000-4000-8000-000000000002";
const FROM = "2026-09-27";
const TO = "2026-10-31";

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

const query = (over: Partial<CalendarQuery>): CalendarQuery => ({
  role: "employee",
  userId: MARCO,
  from: FROM,
  to: TO,
  includeRejected: false,
  ...over,
});

describe("getCalendarRequests: scope lives in the SQL (AGENTS.md rule 3)", () => {
  it("employee: only their own requests, no manager join, the session id is the only id", async () => {
    const { sql, calls } = fakeSql();
    await getCalendarRequests(sql, query({ role: "employee" }));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain("where r.user_id = ?");
    expect(calls[0]?.text).not.toContain("manager_id");
    expect(calls[0]?.values).toEqual([MARCO, false, TO, FROM]);
  });

  it("manager: their own plus their direct reports, filtered with u.manager_id in the query", async () => {
    const { sql, calls } = fakeSql();
    await getCalendarRequests(sql, query({ role: "manager" }));
    expect(calls[0]?.text).toContain("(r.user_id = ? or u.manager_id = ?)");
    expect(calls[0]?.values).toEqual([MARCO, MARCO, false, TO, FROM]);
  });

  it("hr_admin: everyone, so no user or manager filter at all", async () => {
    const { sql, calls } = fakeSql();
    await getCalendarRequests(sql, query({ role: "hr_admin" }));
    expect(calls[0]?.text).not.toContain("r.user_id = ?");
    expect(calls[0]?.text).not.toContain("manager_id = ?");
    expect(calls[0]?.values).toEqual([false, TO, FROM]);
  });

  it("never returns soft-deleted requests, and takes dates as text", async () => {
    const { sql, calls } = fakeSql();
    await getCalendarRequests(sql, query({ role: "manager" }));
    expect(calls[0]?.text).toContain("r.is_deleted = false");
    expect(calls[0]?.text).toContain("r.start_date::text as start_date");
    expect(calls[0]?.text).toContain("r.start_date <= ?::date and r.end_date >= ?::date");
  });

  it("rejected requests only come back when the flag is passed to the query", async () => {
    const off = fakeSql();
    const on = fakeSql();
    await getCalendarRequests(off.sql, query({ includeRejected: false }));
    await getCalendarRequests(on.sql, query({ includeRejected: true }));
    expect(off.calls[0]?.values[1]).toBe(false);
    expect(on.calls[0]?.values[1]).toBe(true);
    expect(on.calls[0]?.text).toContain("r.status in ('pending', 'approved')");
  });

  it("maps database rows to calendar requests", async () => {
    const { sql } = fakeSql([
      {
        id: "r1",
        user_id: MARCO,
        user_name: "Marco Santos",
        leave_type_name: "Sick",
        start_date: "2026-10-08",
        end_date: "2026-10-08",
        status: "approved",
      },
    ]);
    const result = await getCalendarRequests(sql, query({}));
    expect(result).toEqual([
      {
        id: "r1",
        userId: MARCO,
        userName: "Marco Santos",
        leaveTypeName: "Sick",
        startDate: "2026-10-08",
        endDate: "2026-10-08",
        status: "approved",
      },
    ]);
  });
});
