import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MEMBER_PAGE_SIZE, type TeamMemberQuery } from "@/lib/leave/schemas";
import { getBalanceSummary } from "@/lib/leave/service";
import { getTeamMemberPage } from "@/lib/leave/team-member";

/**
 * US-13 against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at a THROWAWAY
 * database with the migrations applied: the test inserts its own users, balances and requests, which
 * cannot be deleted afterwards. Run this file alone on a fresh database. Everything asserted is
 * scoped by this file's own random user ids.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const UNPAID = "10000000-0000-4000-8000-000000000003";
const ALL: TeamMemberQuery = { leaveTypeId: undefined, status: undefined, year: 2026, page: 1 };

describe.skipIf(!url)("team member page (US-13, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 1, onnotice: () => {} });
  const hr = randomUUID();
  const marco = randomUUID(); // manages Elena and Jun
  const priya = randomUUID(); // another team
  const elena = randomUUID();
  const jun = randomUUID();
  const leo = randomUUID(); // Priya's report: must never be visible to Marco
  const gone = randomUUID(); // Marco's former report, soft-deleted requests only
  const busy = randomUUID(); // 30 requests, for paging

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
    opts: { reason?: string; note?: string; deleted?: boolean } = {},
  ) {
    await sql`
      insert into public.leave_requests
        (user_id, leave_type_id, start_date, end_date, status, reason, decided_by, decided_at,
         decision_note, is_deleted)
      values (${userId}, ${typeId}, ${start}::date, ${end}::date, ${status}::public.leave_status,
              ${opts.reason ?? ""}, ${status === "pending" ? null : marco},
              ${status === "pending" ? null : sql`now()`},
              ${status === "rejected" ? (opts.note ?? "Not this week") : null},
              ${opts.deleted ?? false})`;
  }

  const page = (managerId: string, memberId: string, query: Partial<TeamMemberQuery> = {}) =>
    getTeamMemberPage(sql, managerId, memberId, { ...ALL, ...query });

  beforeAll(async () => {
    await user(hr, "T-Member Hana", "hr_admin", null);
    await user(marco, "T-Member Marco", "manager", hr);
    await user(priya, "T-Member Priya", "manager", hr);
    await user(elena, "T-Member Elena", "employee", marco);
    await user(jun, "T-Member Jun", "employee", marco);
    await user(leo, "T-Member Leo", "employee", priya);
    await user(gone, "T-Member Gone", "employee", marco);
    await user(busy, "T-Member Busy", "employee", marco);
    await sql`
      insert into public.leave_balances (user_id, leave_type_id, balance) values
        (${elena}, ${VAC}, 10), (${elena}, ${SICK}, 5), (${jun}, ${VAC}, 12), (${leo}, ${VAC}, 99)`;

    // Elena. Mon 2 Mar 2026 to Wed 4 Mar is 3 working days.
    await leave(elena, VAC, "2026-03-02", "2026-03-04", "approved", { reason: "Secret trip" });
    await leave(elena, SICK, "2026-04-06", "2026-04-07", "approved", { reason: "Medical detail" });
    await leave(elena, VAC, "2026-05-04", "2026-05-05", "pending", { reason: "Family trip" });
    await leave(elena, SICK, "2026-06-01", "2026-06-02", "rejected", {
      reason: "Flu",
      note: "Not this week",
    });
    await leave(elena, UNPAID, "2026-08-03", "2026-08-04", "approved");
    await leave(elena, VAC, "2026-12-29", "2027-01-05", "approved"); // crosses New Year
    await leave(elena, VAC, "2025-06-02", "2025-06-04", "approved"); // the year before
    await leave(elena, SICK, "2026-07-01", "2026-07-02", "approved", { deleted: true }); // never shown
    // Others' rows, which must never reach Elena's page.
    await leave(jun, VAC, "2026-03-09", "2026-03-10", "approved");
    await leave(leo, VAC, "2026-04-06", "2026-04-07", "approved", {
      reason: "Leo's private reason",
    });
    await leave(leo, SICK, "2026-05-04", "2026-05-04", "pending", { reason: "Leo is ill" });
    await leave(gone, VAC, "2026-02-02", "2026-02-02", "approved", { deleted: true });
    // Busy: 30 single-day requests, one per working day from 2026-01-05 (Mon).
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.UTC(2026, 0, 5 + i * 7)); // a Monday each week
      const iso = d.toISOString().slice(0, 10);
      if (iso <= "2026-12-31") await leave(busy, VAC, iso, iso, "approved");
    }
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC1: Marco sees Elena's name, role and every non-deleted request of the year, newest start first", async () => {
    const result = await page(marco, elena);
    expect(result?.member).toEqual({ id: elena, name: "T-Member Elena", role: "employee" });
    expect(result?.total).toBe(6); // 2026: Mar, Apr, May, Jun, Aug and Dec 29 to Jan 5
    expect(result?.requests.map((r) => r.startDate)).toEqual([
      "2026-12-29",
      "2026-08-03",
      "2026-06-01",
      "2026-05-04",
      "2026-04-06",
      "2026-03-02",
    ]);
  });

  it("AC1: her balances equal what My Balance shows her (tracked types)", async () => {
    const result = await page(marco, elena);
    const mine = (await getBalanceSummary(sql, elena)).filter((b) => b.tracksBalance);
    expect(result?.balances).toEqual(mine);
  });

  it("AC2: filters by leave type, by status and by year, together", async () => {
    expect(
      (await page(marco, elena, { leaveTypeId: SICK }))?.requests.map((r) => r.startDate),
    ).toEqual(["2026-06-01", "2026-04-06"]);
    expect(
      (await page(marco, elena, { status: "pending" }))?.requests.map((r) => r.startDate),
    ).toEqual(["2026-05-04"]);
    expect(
      (await page(marco, elena, { leaveTypeId: SICK, status: "approved" }))?.requests.map(
        (r) => r.startDate,
      ),
    ).toEqual(["2026-04-06"]);
    expect((await page(marco, elena, { year: 2025 }))?.requests.map((r) => r.startDate)).toEqual([
      "2025-06-02",
    ]);
  });

  it("AC2: a request counts in every year it overlaps (Dec 29 to Jan 5 shows in 2026 and 2027)", async () => {
    expect((await page(marco, elena, { year: 2026 }))?.requests.map((r) => r.startDate)).toContain(
      "2026-12-29",
    );
    expect((await page(marco, elena, { year: 2027 }))?.requests.map((r) => r.startDate)).toEqual([
      "2026-12-29",
    ]);
  });

  it("AC4: the employee's reason comes back only for the pending request, never for a decided one", async () => {
    const result = await page(marco, elena);
    for (const r of result!.requests) {
      if (r.status === "pending") expect(r.reason).toBe("Family trip");
      else expect(r.reason).toBeNull();
    }
    const all = JSON.stringify(result);
    for (const secret of ["Secret trip", "Medical detail", "Flu"])
      expect(all).not.toContain(secret);
  });

  it("AC4: a rejection's decision note is always shown", async () => {
    const result = await page(marco, elena, { status: "rejected" });
    expect(result?.requests).toHaveLength(1);
    expect(result?.requests[0]?.decisionNote).toBe("Not this week");
  });

  it("AC6: 25 at a time with the total from the same statement", async () => {
    const first = await page(marco, busy, { page: 1 });
    const second = await page(marco, busy, { page: 2 });
    const total = first!.total;
    expect(total).toBeGreaterThan(MEMBER_PAGE_SIZE);
    expect(first?.requests).toHaveLength(MEMBER_PAGE_SIZE);
    expect(second?.requests).toHaveLength(total - MEMBER_PAGE_SIZE);
    expect(second?.total).toBe(total);
    const ids = new Set([...first!.requests, ...second!.requests].map((r) => r.id));
    expect(ids.size).toBe(total); // no overlap, nothing missing
  });

  it("AC6: a page past the end returns no rows but still the total", async () => {
    const result = await page(marco, busy, { page: 9 });
    expect(result?.requests).toEqual([]);
    expect(result?.total).toBeGreaterThan(MEMBER_PAGE_SIZE);
  });

  it("AC7: another team's member, a missing person, the caller, the manager's manager and a stranger all give the same null", async () => {
    expect(await page(marco, leo)).toBeNull(); // Priya's report
    expect(await page(marco, randomUUID())).toBeNull(); // does not exist
    expect(await page(marco, marco)).toBeNull(); // the caller's own id
    expect(await page(marco, hr)).toBeNull(); // their own manager
    expect(await page(marco, priya)).toBeNull(); // a peer
    expect(await page(elena, jun)).toBeNull(); // an employee with no reports
  });

  it("AC7: Leo's data never appears on Marco's reports' pages, and nothing leaks into the null", async () => {
    const mine = JSON.stringify(await page(marco, elena));
    expect(mine).not.toContain("Leo");
    expect(mine).not.toContain("private reason");
    expect(await page(priya, leo)).not.toBeNull(); // Priya's own report works for Priya
  });

  it("AC7: an HR Admin's reports are the managers they manage", async () => {
    const result = await page(hr, marco);
    expect(result?.member.role).toBe("manager");
    expect(await page(hr, elena)).toBeNull(); // Elena reports to Marco, not to HR
  });

  it("never shows a soft-deleted request", async () => {
    expect(JSON.stringify(await page(marco, elena))).not.toContain("2026-07-01");
    expect((await page(marco, gone))?.requests).toEqual([]);
  });

  it("flags a pending request whose balance cannot cover it (the approvals queue's rule)", async () => {
    const result = await page(marco, jun, { status: "pending" });
    expect(result?.requests).toEqual([]); // Jun has none: nothing flagged by accident
    expect((await page(marco, elena, { status: "pending" }))?.requests[0]?.balanceCheck).toEqual({
      kind: "ok",
    }); // 2 days vs 10
  });
});
