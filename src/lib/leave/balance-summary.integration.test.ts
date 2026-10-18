import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBalanceSummary, getDashboardSummary } from "@/lib/leave/service";

/**
 * The one-statement balance summary against a real database. Skipped unless TEST_DATABASE_URL is
 * set. Point it at a THROWAWAY database with the migrations applied (leave types come from the
 * migration): the test inserts its own users, balances and requests, which cannot be deleted
 * afterwards. Everything asserted is scoped by this file's own random user ids.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";

describe.skipIf(!url)("balance summary and approvals count (real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 2, onnotice: () => {} });
  const hr = randomUUID();
  const marco = randomUUID(); // manager of Elena and Jun
  const priya = randomUUID(); // another team
  const elena = randomUUID();
  const jun = randomUUID();
  const leo = randomUUID(); // Priya's report: must never count for Marco

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
    status: "pending" | "approved",
    deleted = false,
  ) {
    await sql`
      insert into public.leave_requests
        (user_id, leave_type_id, start_date, end_date, status, decided_by, decided_at, is_deleted)
      values (${userId}, ${typeId}, ${start}::date, ${end}::date, ${status}::public.leave_status,
              ${status === "pending" ? null : marco}, ${status === "pending" ? null : sql`now()`},
              ${deleted})`;
  }

  beforeAll(async () => {
    await user(hr, "Test HR", "hr_admin", null);
    await user(marco, "Test Marco", "manager", hr);
    await user(priya, "Test Priya", "manager", hr);
    await user(elena, "Test Elena", "employee", marco);
    await user(jun, "Test Jun", "employee", marco);
    await user(leo, "Test Leo", "employee", priya);
    await sql`
      insert into public.leave_balances (user_id, leave_type_id, balance) values
        (${elena}, ${VAC}, 10), (${elena}, ${SICK}, 5), (${jun}, ${VAC}, 99)`;

    // Mon 2 to Wed 4 Nov 2026 is 3 working days.
    await leave(elena, VAC, "2026-11-02", "2026-11-04", "pending");
    await leave(elena, VAC, "2026-11-09", "2026-11-10", "approved"); // not pending
    await leave(elena, SICK, "2026-11-16", "2026-11-17", "pending", true); // soft-deleted
    await leave(jun, VAC, "2026-11-02", "2026-11-02", "pending"); // another person's pending
    await leave(marco, VAC, "2026-11-03", "2026-11-03", "pending"); // his own: not an approval for him
    await leave(leo, VAC, "2026-11-04", "2026-11-04", "pending"); // another team
  });

  afterAll(async () => {
    await sql.end();
  });

  it("returns the leave types in order with text-cast balances shaped as before", async () => {
    const summary = await getBalanceSummary(sql, elena);
    expect(summary.map((s) => s.leaveTypeName)).toEqual(["Vacation", "Sick", "Unpaid"]);
    expect(summary[0]).toMatchObject({
      tracksBalance: true,
      confirmed: 10,
      pending: 3,
      available: 7,
    });
    expect(summary[1]).toMatchObject({ confirmed: 5, pending: 0, available: 5 });
    expect(summary[2]).toMatchObject({ tracksBalance: false, confirmed: null, available: null });
  });

  it("counts only the user's own pending, non-deleted requests (never Jun's balance or request)", async () => {
    const jun_ = await getBalanceSummary(sql, jun);
    expect(jun_[0]).toMatchObject({ confirmed: 99, pending: 1, available: 98 });
    // Elena's soft-deleted pending Sick request is not counted; her approved one is not pending.
    const elena_ = await getBalanceSummary(sql, elena);
    expect(elena_[1]?.pending).toBe(0);
  });

  it("a user with no balance rows or requests gets zeros, not an error", async () => {
    const summary = await getBalanceSummary(sql, leo);
    expect(summary[0]).toMatchObject({ confirmed: 0, pending: 1, available: -1 });
    expect(summary[1]).toMatchObject({ confirmed: 0, pending: 0 });
  });

  it("approvals count: Marco sees his two reports' pending requests, never Leo's or his own", async () => {
    const result = await getDashboardSummary(sql, marco, true);
    expect(result.pendingApprovals).toBe(2);
    expect((await getDashboardSummary(sql, priya, true)).pendingApprovals).toBe(1);
  });

  it("approvals count is null when not asked for, and zero for an approver with no reports", async () => {
    expect((await getDashboardSummary(sql, elena, false)).pendingApprovals).toBeNull();
    expect((await getDashboardSummary(sql, elena, true)).pendingApprovals).toBe(0);
  });
});
