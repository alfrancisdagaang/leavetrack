import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getOutFigures } from "@/lib/leave/out-figures";

/**
 * The dashboard's who-is-out figures against a real database. Skipped unless TEST_DATABASE_URL is
 * set. Point it at a THROWAWAY database with the migrations applied: the test inserts its own users
 * and requests, which cannot be deleted afterwards. Everything is dated September 2033 (a window no
 * other test file uses), so the company-wide figures only see this file's rows; the pending total is
 * compared with a direct count, because other files' pending requests are in the same table.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const TODAY = "2033-09-07"; // a Wednesday: the window is Wed 7 to Tue 13 Sep

describe.skipIf(!url)("dashboard out figures (real database)", () => {
  let statements = 0;
  const sql = postgres(url ?? "", {
    prepare: false,
    max: 1,
    onnotice: () => {},
    debug: () => {
      statements += 1;
    },
  });
  const hr = randomUUID();
  const mgrA = randomUUID();
  const mgrB = randomUUID();
  const a1 = randomUUID();
  const a2 = randomUUID();
  const b1 = randomUUID();
  const loner = randomUUID();

  async function user(uid: string, name: string, role: string, manager: string | null = null) {
    await sql`
      insert into public.users (id, name, email, role, manager_id)
      values (${uid}, ${name}, ${`${uid}@test.example`}, ${role}::public.user_role, ${manager})`;
  }
  async function request(
    userId: string,
    typeId: string,
    start: string,
    end: string,
    status: "pending" | "approved" | "rejected",
    deleted = false,
  ) {
    await sql`
      insert into public.leave_requests
        (user_id, leave_type_id, start_date, end_date, reason, status, decided_by, decided_at,
         decision_note, is_deleted)
      values (${userId}, ${typeId}, ${start}::date, ${end}::date, 'secret', ${status}::public.leave_status,
              ${status === "pending" ? null : hr}, ${status === "pending" ? null : sql`now()`},
              ${status === "rejected" ? "Not this week" : null}, ${deleted})`;
  }
  const figures = (viewerId: string, scope: "company" | "team") =>
    getOutFigures(sql, { viewerId, scope, today: TODAY });
  const totals = (f: Awaited<ReturnType<typeof figures>>) =>
    f.days.map((d) => `${d.day}:${d.total}/${d.pending}`);

  beforeAll(async () => {
    await user(hr, "T-Out Hana", "hr_admin");
    await user(mgrA, "T-Out Marco", "manager");
    await user(mgrB, "T-Out Bea", "manager");
    await user(a1, "T-Out Ana", "employee", mgrA);
    await user(a2, "T-Out Abel", "employee", mgrA);
    await user(b1, "T-Out Ben", "employee", mgrB);
    await user(loner, "T-Out Lone", "employee");

    // Ana: Mon 5 to Thu 8 Sep, so she is already out when the window opens.
    await request(a1, VAC, "2033-09-05", "2033-09-08", "approved");
    // Abel on Thu 8: a pending Sick day and an approved Vacation day (one person, two requests).
    await request(a2, SICK, "2033-09-08", "2033-09-08", "pending");
    await request(a2, VAC, "2033-09-08", "2033-09-08", "approved");
    // Ben: Fri 9 to Tue 13, a weekend inside.
    await request(b1, VAC, "2033-09-09", "2033-09-13", "approved");
    // Never counted: rejected, soft-deleted, after the window, and a weekend-only request.
    await request(b1, VAC, "2033-09-07", "2033-09-07", "rejected");
    await request(a2, VAC, "2033-09-07", "2033-09-07", "approved", true);
    await request(loner, SICK, "2033-09-14", "2033-09-14", "approved");
    await request(loner, VAC, "2033-09-10", "2033-09-11", "approved");
    // A pending request that was soft-deleted: it must not count as waiting for a decision.
    await request(a2, SICK, "2033-09-20", "2033-09-20", "pending", true);
  });

  afterAll(async () => {
    await sql.end();
  });

  it("company: the weekdays of the window with exact counts, a person once, no weekend days", async () => {
    const f = await figures(hr, "company");
    expect(totals(f)).toEqual([
      "2033-09-07:1/0",
      "2033-09-08:2/1",
      "2033-09-09:1/0",
      "2033-09-12:1/0",
      "2033-09-13:1/0",
    ]);
    // Ana, Abel and Ben. The weekend-only request and the one after the window do not count.
    expect(f.weekPeople).toBe(3);
  });

  it("company: the pending total is every pending request, soft-deleted ones aside", async () => {
    const f = await figures(hr, "company");
    const [direct] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.leave_requests
      where status = 'pending' and is_deleted = false`;
    expect(f.pendingTotal).toBe(direct?.n);
    expect(f.pendingTotal).toBeGreaterThanOrEqual(1);
  });

  it("team: a manager sees only their own direct reports, whoever else is out", async () => {
    const a = await figures(mgrA, "team");
    expect(totals(a)).toEqual([
      "2033-09-07:1/0",
      "2033-09-08:2/1",
      "2033-09-09:0/0",
      "2033-09-12:0/0",
      "2033-09-13:0/0",
    ]);
    expect(a.weekPeople).toBe(2);
    expect(a.pendingTotal).toBe(1); // Abel's Sick request
    const b = await figures(mgrB, "team");
    expect(totals(b)).toEqual([
      "2033-09-07:0/0",
      "2033-09-08:0/0",
      "2033-09-09:1/0",
      "2033-09-12:1/0",
      "2033-09-13:1/0",
    ]);
    expect(b.weekPeople).toBe(1);
    expect(b.pendingTotal).toBe(0); // Ben's one pending-looking request was rejected
  });

  it("the scope is the signed-in user's role, in the SQL: anyone else gets nothing", async () => {
    const empty = { days: [], weekPeople: 0, pendingTotal: 0 };
    expect(await figures(mgrA, "company")).toEqual(empty); // a manager cannot read the company
    expect(await figures(hr, "team")).toEqual(empty); // an HR admin has no team
    expect(await figures(a1, "company")).toEqual(empty);
    expect(await figures(a1, "team")).toEqual(empty);
    expect(await figures(randomUUID(), "company")).toEqual(empty);
  });

  it("is ONE statement and never writes", async () => {
    const [before] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.leave_requests where start_date >= '2033-09-01'`;
    statements = 0;
    await figures(hr, "company");
    expect(statements).toBe(1);
    statements = 0;
    await figures(mgrA, "team");
    expect(statements).toBe(1);
    const [after] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.leave_requests where start_date >= '2033-09-01'`;
    expect(after?.n).toBe(before?.n);
  });
});
