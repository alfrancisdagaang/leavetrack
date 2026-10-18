import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { yearBounds } from "@/lib/leave/breakdown";
import { getBalancePage, getBalanceSummary } from "@/lib/leave/service";

/**
 * The My Balance breakdown against a real database. Skipped unless TEST_DATABASE_URL is set. Point
 * it at a THROWAWAY database with the migrations applied (leave types come from the migration):
 * the test inserts its own users, balances, requests and ledger rows, which cannot be deleted
 * afterwards. Everything asserted is scoped by this file's own random user ids.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const UNPAID = "10000000-0000-4000-8000-000000000003";

describe.skipIf(!url)("my balance breakdown (real database)", () => {
  // One connection: getBalancePage runs two statements at once, which a single-session test
  // database (pglite) cannot serve in parallel. A real Postgres is fine with more.
  const sql = postgres(url ?? "", { prepare: false, max: 1, onnotice: () => {} });
  const hr = randomUUID();
  const marco = randomUUID(); // manager of Elena and Jun
  const priya = randomUUID(); // another team
  const elena = randomUUID();
  const jun = randomUUID();
  const leo = randomUUID(); // Priya's report: another team, must never leak into Elena's figures

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
    deleted = false,
  ) {
    await sql`
      insert into public.leave_requests
        (user_id, leave_type_id, start_date, end_date, status, decided_by, decided_at,
         decision_note, is_deleted)
      values (${userId}, ${typeId}, ${start}::date, ${end}::date, ${status}::public.leave_status,
              ${status === "pending" ? null : marco}, ${status === "pending" ? null : sql`now()`},
              ${status === "rejected" ? "Not this week" : null}, ${deleted})`;
  }

  async function ledger(userId: string, typeId: string, period: string, amount: string) {
    await sql`
      insert into public.accrual_ledger (user_id, leave_type_id, period, amount)
      values (${userId}, ${typeId}, ${period}::date, ${amount})`;
  }

  const page = async (userId: string, today: string) =>
    (await getBalancePage(sql, userId, yearBounds(today))).balances;
  const byType = (items: Awaited<ReturnType<typeof page>>, id: string) =>
    items.find((i) => i.leaveTypeId === id)!;

  beforeAll(async () => {
    await user(hr, "Test HR", "hr_admin", null);
    await user(marco, "Test Marco", "manager", hr);
    await user(priya, "Test Priya", "manager", hr);
    await user(elena, "Test Elena", "employee", marco);
    await user(jun, "Test Jun", "employee", marco);
    await user(leo, "Test Leo", "employee", priya);
    await sql`
      insert into public.leave_balances (user_id, leave_type_id, balance) values
        (${elena}, ${VAC}, 10), (${elena}, ${SICK}, 5), (${jun}, ${VAC}, 99), (${leo}, ${VAC}, 7)`;

    // Elena. Mon 2 Mar 2026 to Wed 4 Mar is 3 working days.
    await leave(elena, VAC, "2026-03-02", "2026-03-04", "approved");
    // Crosses New Year: Tue 29 to Thu 31 Dec 2026 is 3 days; Fri 1, Mon 4, Tue 5 Jan 2027 is 3.
    await leave(elena, VAC, "2026-12-29", "2027-01-05", "approved");
    await leave(elena, VAC, "2025-06-02", "2025-06-04", "approved"); // the year before
    await leave(elena, VAC, "2027-02-01", "2027-02-02", "approved"); // 2 days, only in 2027
    await leave(elena, VAC, "2026-05-04", "2026-05-05", "pending"); // pending, not used
    await leave(elena, SICK, "2026-06-01", "2026-06-02", "rejected"); // never counts
    await leave(elena, SICK, "2026-07-01", "2026-07-02", "approved", true); // soft-deleted
    await leave(elena, UNPAID, "2026-08-03", "2026-08-04", "approved"); // 2 days, untracked
    // Other people's rows, which must never reach Elena.
    await leave(jun, VAC, "2026-03-09", "2026-03-10", "approved");
    await leave(leo, VAC, "2026-04-06", "2026-04-07", "approved");

    await ledger(elena, VAC, "2025-12-01", "1.25"); // the year before
    await ledger(elena, VAC, "2026-01-01", "1.25");
    await ledger(elena, VAC, "2026-02-01", "1.25");
    await ledger(elena, VAC, "2027-01-01", "1.25"); // next year
    await ledger(jun, VAC, "2026-01-01", "5.00");
    await ledger(leo, VAC, "2026-01-01", "1.25");
  });

  afterAll(async () => {
    await sql.end();
  });

  it("B3: used counts only approved, non-deleted days; pending, rejected and deleted never count", async () => {
    const items = await page(elena, "2026-10-18");
    expect(byType(items, VAC)).toMatchObject({ usedThisYear: 6, pending: 2 }); // 3 + 3 clipped
    expect(byType(items, SICK)).toMatchObject({ usedThisYear: 0, pending: 0 });
  });

  it("B4: clips to the year and excludes weekends (Dec 29 to Jan 5 is 3 days in each year)", async () => {
    const in2026 = byType(await page(elena, "2026-10-18"), VAC);
    const in2027 = byType(await page(elena, "2027-06-01"), VAC);
    expect(in2026.usedThisYear).toBe(6); // Mar 2-4 (3) + Dec 29-31 (3)
    expect(in2027.usedThisYear).toBe(5); // Jan 1, 4, 5 (3) + Feb 1-2 (2)
  });

  it("B5: a request entirely outside the year is not counted", async () => {
    const in2025 = byType(await page(elena, "2025-09-01"), VAC);
    expect(in2025.usedThisYear).toBe(3); // only Jun 2-4 2025
    const in2028 = byType(await page(elena, "2028-01-10"), VAC);
    expect(in2028.usedThisYear).toBe(0);
  });

  it("B6: accrued sums only the year's ledger months; none means 0 and opening = confirmed + used", async () => {
    const items = await page(elena, "2026-10-18");
    expect(byType(items, VAC)).toMatchObject({ accruedThisYear: 2.5, openingBalance: 13.5 });
    expect(byType(items, SICK)).toMatchObject({ accruedThisYear: 0, openingBalance: 5 });
    expect(byType(await page(elena, "2027-06-01"), VAC).accruedThisYear).toBe(1.25);
  });

  it("B7: Unpaid has used days but no accrued, opening, confirmed or available", async () => {
    const unpaid = byType(await page(elena, "2026-10-18"), UNPAID);
    expect(unpaid).toMatchObject({
      tracksBalance: false,
      usedThisYear: 2,
      accruedThisYear: null,
      openingBalance: null,
      confirmed: null,
      available: null,
    });
  });

  it("B9: another user's requests, ledger rows and balance are never counted", async () => {
    const jun_ = byType(await page(jun, "2026-10-18"), VAC);
    expect(jun_).toMatchObject({ confirmed: 99, usedThisYear: 2, accruedThisYear: 5 });
    const leo_ = byType(await page(leo, "2026-10-18"), VAC);
    expect(leo_).toMatchObject({ confirmed: 7, usedThisYear: 2, accruedThisYear: 1.25 });
    // Elena's own figures are unchanged by either of them (6 used, 2.5 accrued).
    expect(byType(await page(elena, "2026-10-18"), VAC)).toMatchObject({
      usedThisYear: 6,
      accruedThisYear: 2.5,
    });
  });

  it("B2: opening + accrued - used = confirmed for every user and year", async () => {
    for (const id of [elena, jun, leo]) {
      for (const today of ["2025-09-01", "2026-10-18", "2027-06-01"]) {
        for (const item of await page(id, today)) {
          if (!item.tracksBalance) continue;
          const cents = (n: number | null) => Math.round((n ?? 0) * 100);
          expect(
            cents(item.openingBalance) + cents(item.accruedThisYear) - item.usedThisYear * 100,
          ).toBe(cents(item.confirmed));
        }
      }
    }
  });

  it("B10: confirmed, pending and available equal getBalanceSummary's (dashboard and Request Leave)", async () => {
    const old = await getBalanceSummary(sql, elena);
    const wide = (await page(elena, "2026-10-18")).map(
      ({ usedThisYear: _u, accruedThisYear: _a, openingBalance: _o, ...rest }) => rest,
    );
    expect(wide).toEqual(old);
  });
});
