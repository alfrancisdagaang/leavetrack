import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { ACTIVITY_LIMIT, getRecentActivity, type ActivityQuery } from "@/lib/leave/activity";

const MARCO = "00000000-0000-4000-8000-000000000002";

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

const query = (over: Partial<ActivityQuery>): ActivityQuery => ({
  role: "employee",
  userId: MARCO,
  ...over,
});

describe("getRecentActivity: scope lives in the SQL (AGENTS.md rule 3)", () => {
  it("employee: events on their own requests only, no manager join, the session id is the only id", async () => {
    const { sql, calls } = fakeSql();
    await getRecentActivity(sql, query({ role: "employee" }));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain("where r.user_id = ?");
    expect(calls[0]?.text).not.toContain("manager_id");
    expect(calls[0]?.values).toEqual([MARCO, ACTIVITY_LIMIT]);
  });

  it("AC2 manager: events on their own plus their direct reports' requests, with owner.manager_id in the query", async () => {
    const { sql, calls } = fakeSql();
    await getRecentActivity(sql, query({ role: "manager" }));
    expect(calls[0]?.text).toContain("(r.user_id = ? or owner.manager_id = ?)");
    expect(calls[0]?.values).toEqual([MARCO, MARCO, ACTIVITY_LIMIT]);
  });

  it("AC3 hr_admin: everyone, so no where clause at all", async () => {
    const { sql, calls } = fakeSql();
    await getRecentActivity(sql, query({ role: "hr_admin" }));
    expect(calls[0]?.text).not.toContain("where");
    expect(calls[0]?.values).toEqual([ACTIVITY_LIMIT]);
  });

  it.each(["employee", "manager", "hr_admin"] as const)(
    "AC5 %s: newest first, limited, reads the audit log, and keeps a cancelled request's event",
    async (role) => {
      const { sql, calls } = fakeSql();
      await getRecentActivity(sql, query({ role }));
      const text = calls[0]?.text ?? "";
      expect(text).toContain("from public.audit_log a");
      expect(text).toContain("order by a.occurred_at desc, a.id desc limit ?");
      expect(text).toContain("r.start_date::text as start_date");
      // A soft-deleted request's `soft_deleted` event is the feed's "Cancelled" item.
      expect(text).not.toContain("is_deleted");
    },
  );

  it("maps rows to the view shape and turns the timestamp into an ISO string", async () => {
    const row = {
      id: "e1",
      action: "rejected",
      occurred_at: new Date("2026-10-14T07:10:00Z"),
      actor_id: "m1",
      actor_name: "Marco Santos",
      owner_id: "a1",
      owner_name: "Ana Lopez",
      leave_type_name: "Unpaid",
      start_date: "2026-10-12",
      end_date: "2026-10-12",
    };
    const { sql } = fakeSql([row, { ...row, id: "e2", occurred_at: "2026-10-14T07:10:00.000Z" }]);
    const got = await getRecentActivity(sql, query({ role: "hr_admin" }));
    expect(got[0]).toEqual({
      id: "e1",
      action: "rejected",
      occurredAt: "2026-10-14T07:10:00.000Z",
      actorId: "m1",
      actorName: "Marco Santos",
      ownerId: "a1",
      ownerName: "Ana Lopez",
      leaveTypeName: "Unpaid",
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    });
    expect(got[1]?.occurredAt).toBe("2026-10-14T07:10:00.000Z");
  });
});
