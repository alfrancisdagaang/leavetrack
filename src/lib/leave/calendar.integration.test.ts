import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getCalendarRequests } from "@/lib/leave/calendar";

/**
 * US-10 against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at a
 * THROWAWAY database with the migrations applied: the test inserts its own users and requests,
 * and leave requests cannot be hard-deleted afterwards.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";

// The October 2026 grid runs from Sunday 27 Sep to Saturday 31 Oct.
const FROM = "2026-09-27";
const TO = "2026-10-31";

describe.skipIf(!url)("calendar scope and range (US-10, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 2, onnotice: () => {} });
  const hr = randomUUID();
  const marco = randomUUID(); // manager of Elena and Jun
  const elena = randomUUID();
  const jun = randomUUID();
  const priya = randomUUID(); // another team
  const leo = randomUUID(); // Priya's report: must never show for Marco
  const mine = new Set<string>([hr, marco, elena, jun, priya, leo]);

  const idOf: Record<string, string> = {};

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

  const ids = async (query: Parameters<typeof getCalendarRequests>[1]) =>
    (await getCalendarRequests(sql, query)).filter((r) => mine.has(r.userId)).map((r) => r.id);

  beforeAll(async () => {
    await user(hr, "Test HR", "hr_admin", null);
    await user(marco, "Test Marco", "manager", hr);
    await user(priya, "Test Priya", "manager", hr);
    await user(elena, "Test Elena", "employee", marco);
    await user(jun, "Test Jun", "employee", marco);
    await user(leo, "Test Leo", "employee", priya);

    await leave("elenaPending", elena, VAC, "2026-10-05", "2026-10-07", "pending");
    await leave("elenaSpan", elena, VAC, "2026-09-29", "2026-10-02", "approved"); // starts before the month
    await leave("elenaRejected", elena, VAC, "2026-10-20", "2026-10-21", "rejected");
    await leave("elenaDeleted", elena, VAC, "2026-10-26", "2026-10-26", "approved", true);
    await leave("elenaNovember", elena, VAC, "2026-11-10", "2026-11-12", "approved");
    await leave("junApproved", jun, SICK, "2026-10-12", "2026-10-14", "approved");
    await leave("marcoOwn", marco, VAC, "2026-10-19", "2026-10-19", "approved");
    await leave("leoApproved", leo, VAC, "2026-10-12", "2026-10-14", "approved");
    await leave("priyaOwn", priya, SICK, "2026-10-08", "2026-10-08", "approved");
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC1: an employee sees only their own requests (pending and approved)", async () => {
    const got = await ids({
      role: "employee",
      userId: elena,
      from: FROM,
      to: TO,
      includeRejected: false,
    });
    expect(new Set(got)).toEqual(new Set([idOf.elenaPending, idOf.elenaSpan]));
  });

  it("AC2: a manager sees their own and their direct reports', and never another team's", async () => {
    const got = await ids({
      role: "manager",
      userId: marco,
      from: FROM,
      to: TO,
      includeRejected: false,
    });
    expect(new Set(got)).toEqual(
      new Set([idOf.elenaPending, idOf.elenaSpan, idOf.junApproved, idOf.marcoOwn]),
    );
    expect(got).not.toContain(idOf.leoApproved);
    expect(got).not.toContain(idOf.priyaOwn);
  });

  it("AC2: the other team's manager sees Leo, and not Marco's team", async () => {
    const got = await ids({
      role: "manager",
      userId: priya,
      from: FROM,
      to: TO,
      includeRejected: false,
    });
    expect(new Set(got)).toEqual(new Set([idOf.leoApproved, idOf.priyaOwn]));
  });

  it("AC3: HR sees every employee's requests", async () => {
    const got = await ids({
      role: "hr_admin",
      userId: hr,
      from: FROM,
      to: TO,
      includeRejected: false,
    });
    for (const key of [
      "elenaPending",
      "elenaSpan",
      "junApproved",
      "marcoOwn",
      "leoApproved",
      "priyaOwn",
    ]) {
      expect(got).toContain(idOf[key]);
    }
  });

  it("AC4: rejected requests only appear when asked for", async () => {
    const hidden = await ids({
      role: "employee",
      userId: elena,
      from: FROM,
      to: TO,
      includeRejected: false,
    });
    const shown = await ids({
      role: "employee",
      userId: elena,
      from: FROM,
      to: TO,
      includeRejected: true,
    });
    expect(hidden).not.toContain(idOf.elenaRejected);
    expect(shown).toContain(idOf.elenaRejected);
  });

  it("never returns a soft-deleted request, even with the rejected switch on", async () => {
    const got = await ids({
      role: "hr_admin",
      userId: hr,
      from: FROM,
      to: TO,
      includeRejected: true,
    });
    expect(got).not.toContain(idOf.elenaDeleted);
  });

  it("includes a request that starts before the range, and leaves out one outside it", async () => {
    const day = await ids({
      role: "employee",
      userId: elena,
      from: "2026-10-01",
      to: "2026-10-01",
      includeRejected: false,
    });
    expect(day).toEqual([idOf.elenaSpan]); // 29 Sep to 2 Oct covers 1 Oct
    const november = await ids({
      role: "employee",
      userId: elena,
      from: "2026-11-01",
      to: "2026-11-30",
      includeRejected: false,
    });
    expect(november).toEqual([idOf.elenaNovember]);
  });

  it("returns dates as text and orders by start date", async () => {
    const rows = await getCalendarRequests(sql, {
      role: "employee",
      userId: elena,
      from: FROM,
      to: TO,
      includeRejected: false,
    });
    expect(rows.map((r) => r.startDate)).toEqual(["2026-09-29", "2026-10-05"]);
    expect(typeof rows[0]?.endDate).toBe("string");
  });
});
