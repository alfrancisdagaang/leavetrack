import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getDayPeople,
  getHrCalendarChoices,
  getMonthCounts,
  HR_DAY_PAGE_SIZE,
} from "@/lib/leave/hr-calendar";

/**
 * EPIC-7 (TASK-042) against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at a
 * THROWAWAY database with the migrations applied: the test inserts its own users and requests, which
 * cannot be deleted afterwards. Everything is dated March 2031 and scoped to this file's own teams
 * (each read filters by one of its managers, or counts only the days it plants), so other rows in
 * the database cannot change a result. The "company wide" reads are checked on a day only this file uses.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const SECRET = "secret medical detail";

describe.skipIf(!url)("HR calendar reads (EPIC-7 TASK-042, real database)", () => {
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
  const mgrC = randomUUID();
  const a1 = randomUUID();
  const a2 = randomUUID();
  const b1 = randomUUID();
  const loner = randomUUID(); // no manager

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
      values (${userId}, ${typeId}, ${start}::date, ${end}::date, ${SECRET},
              ${status}::public.leave_status, ${status === "pending" ? null : hr},
              ${status === "pending" ? null : sql`now()`},
              ${status === "rejected" ? "Not this week" : null}, ${deleted})`;
  }

  const MARCH = { from: "2031-03-01", to: "2031-03-31" };
  const FEB = { from: "2031-02-01", to: "2031-02-28" };
  const day = (rows: Awaited<ReturnType<typeof getMonthCounts>>, d: string) =>
    rows.find((r) => r.day === d);

  beforeAll(async () => {
    await user(hr, "T-Cal Hana", "hr_admin");
    await user(mgrA, "T-Cal Marco", "manager");
    await user(mgrB, "T-Cal Bea", "manager");
    await user(mgrC, "T-Cal Carl", "manager");
    await user(a1, "T-Cal Ana", "employee", mgrA);
    await user(a2, "T-Cal Abel", "employee", mgrA);
    await user(b1, "T-Cal Ben", "employee", mgrB);
    await user(loner, "T-Cal Lone", "employee");

    // Ana: Vacation, Wed 26 Feb to Tue 4 Mar (spans the month edge and a weekend).
    await request(a1, VAC, "2031-02-26", "2031-03-04", "approved");
    // Abel on Mon 3 Mar: a pending Sick day and an approved Vacation day (one person, two requests).
    await request(a2, SICK, "2031-03-03", "2031-03-03", "pending");
    await request(a2, VAC, "2031-03-03", "2031-03-03", "approved");
    // Ben: Vacation Mon 3 to Wed 5 Mar.
    await request(b1, VAC, "2031-03-03", "2031-03-05", "approved");
    // Never counted: rejected, soft-deleted (approved), and a weekend-only request.
    await request(b1, VAC, "2031-03-10", "2031-03-10", "rejected");
    await request(b1, VAC, "2031-03-11", "2031-03-11", "approved", true);
    await request(a1, VAC, "2031-03-08", "2031-03-09", "approved");
    // The lone person (no manager) is out on Fri 7 Mar.
    await request(loner, SICK, "2031-03-07", "2031-03-07", "approved");

    // 30 people on Mon 17 Mar, all in team C, for paging and the name search.
    for (let i = 0; i < 30; i++) {
      const uid = randomUUID();
      await user(uid, `T-Cal Pager ${String(i).padStart(2, "0")}`, "employee", mgrC);
      await request(uid, i % 2 === 0 ? VAC : SICK, "2031-03-17", "2031-03-17", "approved");
    }
    // A name with a percent sign, to prove the search is literal.
    const pct = randomUUID();
    await user(pct, "T-Cal Pct%Pat", "employee", mgrC);
    await request(pct, VAC, "2031-03-17", "2031-03-17", "pending");
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC1: counts people per weekday, split by leave type and by status, for one team", async () => {
    const rows = await getMonthCounts(sql, { viewerId: hr, ...MARCH, managerId: mgrA });
    // Mon 3 Mar: Ana (approved Vacation) and Abel (approved Vacation + pending Sick).
    expect(day(rows, "2031-03-03")).toEqual({
      day: "2031-03-03",
      total: 2,
      approved: 2,
      pending: 1,
      byType: [
        { leaveTypeName: "Sick", approved: 0, pending: 1 },
        { leaveTypeName: "Vacation", approved: 2, pending: 0 },
      ],
    });
    // Tue 4 Mar: only Ana.
    expect(day(rows, "2031-03-04")).toMatchObject({ total: 1, approved: 1, pending: 0 });
    // Ana's request ended on the 4th.
    expect(day(rows, "2031-03-05")).toBeUndefined();
  });

  it("AC1: a person with two overlapping requests is one person in the day's total", async () => {
    const rows = await getMonthCounts(sql, { viewerId: hr, ...MARCH, managerId: mgrA });
    const abelOnly = await getDayPeople(sql, {
      viewerId: hr,
      day: "2031-03-03",
      managerId: mgrA,
      page: 1,
      q: "Abel",
    });
    expect(abelOnly.total).toBe(2); // two requests are listed ...
    expect(day(rows, "2031-03-03")?.total).toBe(2); // ... but Ana and Abel are two people, not three.
  });

  it("AC1: the team filter and the leave type filter narrow the counts", async () => {
    const teamB = await getMonthCounts(sql, { viewerId: hr, ...MARCH, managerId: mgrB });
    expect(day(teamB, "2031-03-03")).toMatchObject({ total: 1 });
    expect(day(teamB, "2031-03-05")).toMatchObject({ total: 1 });
    // The team A person is not in team B's counts.
    expect(day(teamB, "2031-03-04")).toMatchObject({ total: 1 }); // Ben, not Ana
    const sick = await getMonthCounts(sql, {
      viewerId: hr,
      ...MARCH,
      managerId: mgrA,
      leaveTypeId: SICK,
    });
    expect(day(sick, "2031-03-03")).toEqual({
      day: "2031-03-03",
      total: 1,
      approved: 0,
      pending: 1,
      byType: [{ leaveTypeName: "Sick", approved: 0, pending: 1 }],
    });
    expect(day(sick, "2031-03-04")).toBeUndefined();
  });

  it("AC1: with no team filter the whole company is counted, people without a manager included", async () => {
    const rows = await getMonthCounts(sql, { viewerId: hr, ...MARCH });
    expect(day(rows, "2031-03-03")?.total).toBe(3); // Ana, Abel, Ben
    expect(day(rows, "2031-03-07")?.total).toBe(1); // the person with no manager
  });

  it("AC3: a request that spans two months is counted in both, and weekends are never counted", async () => {
    const feb = await getMonthCounts(sql, { viewerId: hr, ...FEB, managerId: mgrA });
    expect(feb.map((r) => r.day)).toEqual(["2031-02-26", "2031-02-27", "2031-02-28"]);
    const march = await getMonthCounts(sql, { viewerId: hr, ...MARCH, managerId: mgrA });
    expect(day(march, "2031-03-03")).toBeDefined();
    // 1-2 Mar (Sat, Sun) are inside Ana's request and 8-9 Mar is a weekend-only request.
    for (const d of ["2031-03-01", "2031-03-02", "2031-03-08", "2031-03-09"]) {
      expect(day(march, d), d).toBeUndefined();
    }
  });

  it("AC2/AC3: rejected and soft-deleted requests are never counted or listed", async () => {
    const rows = await getMonthCounts(sql, { viewerId: hr, ...MARCH, managerId: mgrB });
    expect(day(rows, "2031-03-10")).toBeUndefined(); // rejected
    expect(day(rows, "2031-03-11")).toBeUndefined(); // deleted
    for (const d of ["2031-03-10", "2031-03-11"]) {
      const list = await getDayPeople(sql, { viewerId: hr, day: d, managerId: mgrB, page: 1 });
      expect(list.total, d).toBe(0);
    }
  });

  it("AC2: a day lists exactly the people out, with their team, type, dates and status, and no reason", async () => {
    const list = await getDayPeople(sql, {
      viewerId: hr,
      day: "2031-03-03",
      managerId: mgrA,
      page: 1,
    });
    expect(list.total).toBe(3);
    expect(list.people.map((p) => [p.name, p.leaveTypeName, p.status])).toEqual([
      ["T-Cal Abel", "Sick", "pending"],
      ["T-Cal Abel", "Vacation", "approved"],
      ["T-Cal Ana", "Vacation", "approved"],
    ]);
    const ana = list.people.find((p) => p.name === "T-Cal Ana");
    expect(ana).toMatchObject({
      managerName: "T-Cal Marco",
      startDate: "2031-02-26",
      endDate: "2031-03-04",
    });
    expect(JSON.stringify(list)).not.toContain(SECRET);
    const lone = await getDayPeople(sql, {
      viewerId: hr,
      day: "2031-03-07",
      page: 1,
      q: "T-Cal Lone",
    });
    expect(lone.people[0]?.managerName).toBeNull();
  });

  it("AC2: a weekend day lists nobody, even with a request planted on it", async () => {
    const list = await getDayPeople(sql, {
      viewerId: hr,
      day: "2031-03-08",
      managerId: mgrA,
      page: 1,
    });
    expect(list).toEqual({ total: 0, page: 1, people: [] });
  });

  it("AC2: pages of 25, a page past the end shows the last page, and the name search is literal", async () => {
    expect(HR_DAY_PAGE_SIZE).toBe(25);
    const first = await getDayPeople(sql, {
      viewerId: hr,
      day: "2031-03-17",
      managerId: mgrC,
      page: 1,
    });
    expect(first.total).toBe(31);
    expect(first.people).toHaveLength(25);
    const second = await getDayPeople(sql, {
      viewerId: hr,
      day: "2031-03-17",
      managerId: mgrC,
      page: 2,
    });
    expect(second.people).toHaveLength(6);
    const past = await getDayPeople(sql, {
      viewerId: hr,
      day: "2031-03-17",
      managerId: mgrC,
      page: 40,
    });
    expect(past.page).toBe(2);
    expect(past.people.map((p) => p.requestId)).toEqual(second.people.map((p) => p.requestId));
    const one = await getDayPeople(sql, {
      viewerId: hr,
      day: "2031-03-17",
      managerId: mgrC,
      page: 1,
      q: "Pager 07",
    });
    expect(one.people.map((p) => p.name)).toEqual(["T-Cal Pager 07"]);
    const pct = await getDayPeople(sql, {
      viewerId: hr,
      day: "2031-03-17",
      managerId: mgrC,
      page: 1,
      q: "%",
    });
    expect(pct.people.map((p) => p.name)).toEqual(["T-Cal Pct%Pat"]);
    const sick = await getDayPeople(sql, {
      viewerId: hr,
      day: "2031-03-17",
      managerId: mgrC,
      page: 1,
      leaveTypeId: SICK,
    });
    expect(sick.total).toBe(15);
  });

  it("AC4: each read is ONE statement, and the page choices list leave types and managers", async () => {
    statements = 0;
    await getMonthCounts(sql, { viewerId: hr, ...MARCH, managerId: mgrA });
    expect(statements).toBe(1);
    statements = 0;
    await getDayPeople(sql, { viewerId: hr, day: "2031-03-03", managerId: mgrA, page: 1 });
    expect(statements).toBe(1);
    statements = 0;
    const choices = await getHrCalendarChoices(sql, { viewerId: hr });
    expect(statements).toBe(1);
    expect(choices.leaveTypes.map((t) => t.name)).toContain("Vacation");
    const names = choices.managers.map((m) => m.name);
    expect(names).toContain("T-Cal Marco");
    // Someone nobody reports to is not a team.
    expect(names).not.toContain("T-Cal Hana");
    expect(names).not.toContain("T-Cal Ana");
  });

  it("TASK-042 AC4: the scope is the hr_admin role, in the SQL: nobody else gets anything", async () => {
    for (const viewerId of [mgrA, a1, loner, randomUUID()]) {
      expect(await getMonthCounts(sql, { viewerId, ...MARCH }), viewerId).toEqual([]);
      const list = await getDayPeople(sql, { viewerId, day: "2031-03-03", page: 1 });
      expect(list, viewerId).toEqual({ total: 0, page: 1, people: [] });
      expect(await getHrCalendarChoices(sql, { viewerId }), viewerId).toEqual({
        leaveTypes: [],
        managers: [],
      });
    }
    // The same reads for the HR admin are not empty, so the empty answers above prove the gate.
    expect((await getMonthCounts(sql, { viewerId: hr, ...MARCH })).length).toBeGreaterThan(0);
  });

  it("never writes: the requests are unchanged after every read", async () => {
    const [before] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.leave_requests where start_date >= '2031-02-01'`;
    await getMonthCounts(sql, { viewerId: hr, ...MARCH });
    await getDayPeople(sql, { viewerId: hr, day: "2031-03-03", page: 1 });
    const [after] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.leave_requests where start_date >= '2031-02-01'`;
    expect(after?.n).toBe(before?.n);
  });
});
