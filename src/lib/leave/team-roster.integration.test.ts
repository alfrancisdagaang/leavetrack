import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBalanceSummary } from "@/lib/leave/service";
import { getTeamRoster } from "@/lib/leave/team-roster";

/**
 * US-12 against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at a THROWAWAY
 * database with the migrations applied (leave types come from the migration): the test inserts its
 * own users, balances and requests, which cannot be deleted afterwards. Run this file alone on a
 * fresh database. Everything asserted is scoped by this file's own random user ids.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const TODAY = "2026-10-18";

describe.skipIf(!url)("team roster (US-12, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 1, onnotice: () => {} });
  const hr = randomUUID();
  const marco = randomUUID(); // manages Elena and Jun
  const priya = randomUUID(); // another team: manages Leo
  const elena = randomUUID();
  const jun = randomUUID();
  const leo = randomUUID(); // Priya's report: must never show for Marco
  const mia = randomUUID(); // Marco's report with no activity at all

  async function user(id: string, name: string, role: string, managerId: string | null) {
    await sql`
      insert into public.users (id, name, email, role, manager_id)
      values (${id}, ${name}, ${`${id}@test.example`}, ${role}::public.user_role, ${managerId})`;
  }

  async function leave(
    userId: string,
    typeId: string,
    start: string,
    end: string,
    status: "pending" | "approved" | "rejected",
    createdAt: string,
    deleted = false,
  ) {
    await sql`
      insert into public.leave_requests
        (user_id, leave_type_id, start_date, end_date, status, decided_by, decided_at,
         decision_note, is_deleted, created_at)
      values (${userId}, ${typeId}, ${start}::date, ${end}::date, ${status}::public.leave_status,
              ${status === "pending" ? null : marco}, ${status === "pending" ? null : sql`now()`},
              ${status === "rejected" ? "Not this week" : null}, ${deleted},
              ${createdAt}::timestamptz)`;
  }

  const roster = (managerId: string) => getTeamRoster(sql, managerId, TODAY);
  const byName = async (managerId: string) =>
    Object.fromEntries((await roster(managerId)).map((m) => [m.name, m]));

  beforeAll(async () => {
    await user(hr, "T-Roster Hana", "hr_admin", null);
    await user(marco, "T-Roster Marco", "manager", hr);
    await user(priya, "T-Roster Priya", "manager", hr);
    await user(elena, "T-Roster Elena", "employee", marco);
    await user(jun, "T-Roster Jun", "employee", marco);
    await user(mia, "T-Roster Mia", "employee", marco);
    await user(leo, "T-Roster Leo", "employee", priya);
    await sql`
      insert into public.leave_balances (user_id, leave_type_id, balance) values
        (${elena}, ${VAC}, 10), (${elena}, ${SICK}, 5),
        (${jun}, ${VAC}, 12), (${jun}, ${SICK}, 4),
        (${leo}, ${VAC}, 99)`;

    // Elena: out today (Fri 16 to Tue 20 Oct), two pending, one deleted pending, a later approved leave.
    await leave(elena, VAC, "2026-10-16", "2026-10-20", "approved", "2026-10-01T09:00:00Z");
    await leave(elena, VAC, "2026-11-09", "2026-11-10", "pending", "2026-10-05T09:00:00Z");
    await leave(elena, SICK, "2026-11-16", "2026-11-17", "pending", "2026-10-06T09:00:00Z");
    await leave(elena, SICK, "2026-12-01", "2026-12-01", "pending", "2026-10-07T09:00:00Z", true);
    // Jun: not out today; next approved leave starts 2 Nov; an earlier one is over; a pending one is ignored for "next".
    await leave(jun, VAC, "2026-09-01", "2026-09-02", "approved", "2026-08-20T09:00:00Z");
    await leave(jun, VAC, "2026-11-02", "2026-11-03", "approved", "2026-10-10T09:00:00Z");
    await leave(jun, SICK, "2026-10-25", "2026-10-26", "pending", "2026-10-12T09:00:00Z");
    await leave(jun, SICK, "2026-10-27", "2026-10-27", "rejected", "2026-10-11T09:00:00Z");
    // Mia: a pending and a rejected request that both cover today. Neither is approved leave, so she must
    // NOT show as out today; the pending one counts, and the later-submitted (rejected) one is her last.
    await leave(mia, VAC, "2026-10-16", "2026-10-20", "pending", "2026-10-14T09:00:00Z");
    await leave(mia, VAC, "2026-10-17", "2026-10-19", "rejected", "2026-10-15T09:00:00Z");
    // Leo (another team): rows that must never change anything on Marco's roster.
    await leave(leo, VAC, "2026-10-17", "2026-10-19", "approved", "2026-10-02T09:00:00Z");
    await leave(leo, VAC, "2026-10-30", "2026-10-30", "pending", "2026-10-03T09:00:00Z");
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC1: Marco's roster is exactly his three reports, in name order; never himself, Leo, Priya or HR", async () => {
    const names = (await roster(marco)).map((m) => m.name);
    expect(names).toEqual(["T-Roster Elena", "T-Roster Jun", "T-Roster Mia"]);
  });

  it("AC1: another team's roster is theirs only (Priya sees Leo and nobody from Marco's team)", async () => {
    expect((await roster(priya)).map((m) => m.name)).toEqual(["T-Roster Leo"]);
  });

  it("AC1: an HR Admin's reports are the managers they manage", async () => {
    const members = await roster(hr);
    expect(members.map((m) => m.name)).toEqual(["T-Roster Marco", "T-Roster Priya"]);
    expect(members.map((m) => m.role)).toEqual(["manager", "manager"]);
  });

  it("AC3: someone with no reports gets an empty roster, not an error", async () => {
    expect(await roster(elena)).toEqual([]);
    expect(await roster(randomUUID())).toEqual([]);
  });

  it("AC2: out today, the next approved leave, or nothing planned (a pending or rejected request covering today is not leave)", async () => {
    const team = await byName(marco);
    expect(team["T-Roster Elena"]?.status).toEqual({ kind: "out_today" });
    expect(team["T-Roster Jun"]?.status).toEqual({ kind: "next_leave", start: "2026-11-02" });
    expect(team["T-Roster Mia"]?.status).toEqual({ kind: "none" });
  });

  it("AC2: pending counts only the person's own pending, non-deleted requests", async () => {
    const team = await byName(marco);
    expect(team["T-Roster Elena"]?.pendingCount).toBe(2); // the deleted one is not counted
    expect(team["T-Roster Jun"]?.pendingCount).toBe(1);
    expect(team["T-Roster Mia"]?.pendingCount).toBe(1);
  });

  it("AC2: the last request is the most recently submitted one that is not deleted, with its status", async () => {
    const team = await byName(marco);
    expect(team["T-Roster Elena"]?.lastRequest).toEqual({
      leaveTypeName: "Sick",
      status: "pending",
    });
    expect(team["T-Roster Jun"]?.lastRequest).toEqual({ leaveTypeName: "Sick", status: "pending" });
    expect(team["T-Roster Mia"]?.lastRequest).toEqual({
      leaveTypeName: "Vacation",
      status: "rejected",
    });
  });

  it("AC2: days left equal what My Balance shows for the same person (tracked types)", async () => {
    for (const member of await roster(marco)) {
      const mine = (await getBalanceSummary(sql, member.id)).filter((b) => b.tracksBalance);
      expect(member.balances).toEqual(mine);
    }
    const elena_ = (await byName(marco))["T-Roster Elena"]!;
    expect(elena_.balances.map((b) => [b.leaveTypeName, b.available])).toEqual([
      ["Vacation", 8], // 10 less the 2 pending days
      ["Sick", 3], // 5 less the 2 pending days
    ]);
  });

  it("another team's rows never change a figure (Leo's leave is not Elena's or Jun's)", async () => {
    const team = await byName(marco);
    expect(team["T-Roster Jun"]?.status).toEqual({ kind: "next_leave", start: "2026-11-02" });
    expect(Object.keys(team)).not.toContain("T-Roster Leo");
  });
});
