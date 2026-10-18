import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getRecentActivity } from "@/lib/leave/activity";
import { getUpcomingLeave } from "@/lib/leave/upcoming";

/**
 * US-11 against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at a
 * THROWAWAY database with the migrations applied, NO seed data and no rows from any other test
 * (both lists are limited to five rows, so other people's rows would crowd out the ones asserted
 * here; run this file alone on a fresh database): the test inserts its own users, requests and
 * audit rows, and neither can be deleted afterwards.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const TODAY = "2026-10-15";

describe.skipIf(!url)("upcoming leave and recent activity scope (US-11, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 2, onnotice: () => {} });
  const hr = randomUUID();
  const marco = randomUUID(); // manager of Elena and Jun
  const elena = randomUUID();
  const jun = randomUUID();
  const priya = randomUUID(); // another team
  const leo = randomUUID(); // Priya's report: must never show for Marco
  const mine = new Set<string>([hr, marco, elena, jun, priya, leo]);

  const idOf: Record<string, string> = {};
  const auditOf: Record<string, string> = {};

  async function user(id: string, name: string, role: string, managerId: string | null) {
    await sql`
      insert into public.users (id, name, email, role, manager_id)
      values (${id}, ${name}, ${`${id}@test.example`}, ${role}::public.user_role, ${managerId})`;
  }

  async function leave(
    key: string,
    userId: string,
    typeId: string,
    start: string,
    end: string,
    status: "pending" | "approved" | "rejected",
    deleted = false,
  ) {
    const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests
        (user_id, leave_type_id, start_date, end_date, status, decided_by, decided_at, decision_note,
         is_deleted)
      values (${userId}, ${typeId}, ${start}::date, ${end}::date, ${status}::public.leave_status,
              ${status === "pending" ? null : marco}, ${status === "pending" ? null : sql`now()`},
              ${status === "rejected" ? "Not this week" : null},
              ${deleted})
      returning id`;
    idOf[key] = row!.id;
  }

  async function audit(
    key: string,
    requestKey: string,
    actorId: string,
    action: "submitted" | "approved" | "rejected" | "soft_deleted",
    occurredAt: string,
  ) {
    const [row] = await sql<{ id: string }[]>`
      insert into public.audit_log (leave_request_id, actor_id, action, occurred_at)
      values (${idOf[requestKey]!}, ${actorId}, ${action}::public.audit_action, ${occurredAt}::timestamptz)
      returning id`;
    auditOf[key] = row!.id;
  }

  const upcoming = async (role: "employee" | "manager" | "hr_admin", userId: string) =>
    (await getUpcomingLeave(sql, { role, userId, today: TODAY }))
      .filter((r) => mine.has(r.userId))
      .map((r) => r.id);

  const activity = async (role: "employee" | "manager" | "hr_admin", userId: string) =>
    (await getRecentActivity(sql, { role, userId }))
      .filter((e) => mine.has(e.ownerId))
      .map((e) => e.id);

  beforeAll(async () => {
    await user(hr, "Test HR", "hr_admin", null);
    await user(marco, "Test Marco", "manager", hr);
    await user(priya, "Test Priya", "manager", hr);
    await user(elena, "Test Elena", "employee", marco);
    await user(jun, "Test Jun", "employee", marco);
    await user(leo, "Test Leo", "employee", priya);

    await leave("elenaPending", elena, VAC, "2026-10-21", "2026-10-23", "pending");
    await leave("elenaUnderWay", elena, SICK, "2026-10-14", "2026-10-16", "approved"); // began before today
    await leave("elenaPast", elena, VAC, "2026-10-05", "2026-10-07", "approved"); // ended
    await leave("elenaRejected", elena, VAC, "2026-10-26", "2026-10-27", "rejected");
    await leave("elenaDeleted", elena, VAC, "2026-10-28", "2026-10-28", "approved", true);
    await leave("junPending", jun, SICK, "2026-11-02", "2026-11-03", "pending");
    await leave("marcoOwn", marco, VAC, "2026-11-09", "2026-11-09", "approved");
    await leave("leoPending", leo, VAC, "2026-10-22", "2026-10-22", "pending");
    await leave("priyaOwn", priya, SICK, "2026-10-30", "2026-10-30", "approved");

    await audit("elenaSubmitted", "elenaPending", elena, "submitted", "2026-10-10T01:00:00Z");
    await audit("elenaRejectedEvt", "elenaRejected", marco, "rejected", "2026-10-11T01:00:00Z");
    await audit("elenaCancelled", "elenaDeleted", elena, "soft_deleted", "2026-10-12T01:00:00Z");
    await audit("junSubmitted", "junPending", jun, "submitted", "2026-10-13T01:00:00Z");
    await audit("marcoApproved", "marcoOwn", hr, "approved", "2026-10-14T01:00:00Z");
    await audit("leoSubmitted", "leoPending", leo, "submitted", "2026-10-14T02:00:00Z");
    await audit("priyaApproved", "priyaOwn", hr, "approved", "2026-10-14T03:00:00Z");
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC1: an employee's upcoming leave is only their own pending and approved, under way included", async () => {
    const got = await upcoming("employee", elena);
    expect(got).toEqual([idOf.elenaUnderWay, idOf.elenaPending]); // soonest first
  });

  it("AC4: rejected, cancelled and finished requests are never listed", async () => {
    for (const [role, id] of [
      ["employee", elena],
      ["manager", marco],
      ["hr_admin", hr],
    ] as const) {
      const got = await upcoming(role, id);
      expect(got).not.toContain(idOf.elenaRejected);
      expect(got).not.toContain(idOf.elenaDeleted);
      expect(got).not.toContain(idOf.elenaPast);
    }
  });

  it("AC2: a manager's upcoming leave is their own and their reports', never another team's", async () => {
    const got = await upcoming("manager", marco);
    expect(new Set(got)).toEqual(
      new Set([idOf.elenaUnderWay, idOf.elenaPending, idOf.junPending, idOf.marcoOwn]),
    );
    expect(got).not.toContain(idOf.leoPending);
    expect(got).not.toContain(idOf.priyaOwn);
  });

  it("AC2: the other team's manager sees Leo, and not Marco's team", async () => {
    const got = await upcoming("manager", priya);
    expect(new Set(got)).toEqual(new Set([idOf.leoPending, idOf.priyaOwn]));
  });

  it("AC3 and AC1: HR's upcoming leave covers every team, soonest first, at most five", async () => {
    const got = await upcoming("hr_admin", hr);
    expect(got).toEqual([
      idOf.elenaUnderWay,
      idOf.elenaPending,
      idOf.leoPending,
      idOf.priyaOwn,
      idOf.junPending,
    ]); // Marco's own request on 9 Nov is the sixth, so it is cut by the limit
  });

  it("AC5: an employee's activity is only events on their own requests, newest first, cancelled included", async () => {
    const got = await activity("employee", elena);
    expect(got).toEqual([auditOf.elenaCancelled, auditOf.elenaRejectedEvt, auditOf.elenaSubmitted]);
  });

  it("AC2: a manager's activity is their own and their reports', newest first, never another team's", async () => {
    const got = await activity("manager", marco);
    expect(got).toEqual([
      auditOf.marcoApproved,
      auditOf.junSubmitted,
      auditOf.elenaCancelled,
      auditOf.elenaRejectedEvt,
      auditOf.elenaSubmitted,
    ]);
    expect(got).not.toContain(auditOf.leoSubmitted);
    expect(got).not.toContain(auditOf.priyaApproved);
  });

  it("AC2: the other team's manager sees Leo's events, and not Marco's team's", async () => {
    const got = await activity("manager", priya);
    expect(new Set(got)).toEqual(new Set([auditOf.leoSubmitted, auditOf.priyaApproved]));
  });

  it("AC3 and AC5: HR's activity covers every team, newest first, at most five", async () => {
    const got = await activity("hr_admin", hr);
    expect(got).toEqual([
      auditOf.priyaApproved,
      auditOf.leoSubmitted,
      auditOf.marcoApproved,
      auditOf.junSubmitted,
      auditOf.elenaCancelled,
    ]); // Elena's two older events are cut by the limit
  });

  it("AC5: an event names the actor and the request owner separately", async () => {
    const events = await getRecentActivity(sql, { role: "employee", userId: elena });
    const rejected = events.find((e) => e.id === auditOf.elenaRejectedEvt);
    expect(rejected?.actorName).toBe("Test Marco");
    expect(rejected?.ownerName).toBe("Test Elena");
    expect(rejected?.action).toBe("rejected");
    expect(rejected?.startDate).toBe("2026-10-26");
  });
});
