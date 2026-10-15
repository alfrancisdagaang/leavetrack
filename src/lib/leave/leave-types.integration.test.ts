import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decideLeaveRequest } from "@/lib/leave/decide";
import { createLeaveRequest } from "@/lib/leave/service";

/**
 * US-08 against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at a
 * THROWAWAY database with the migrations applied (never a database with real data): the test
 * inserts its own users and requests, and leave requests cannot be hard-deleted afterwards.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const UNPAID = "10000000-0000-4000-8000-000000000003";

// Mon 2026-11-02 to Wed 2026-11-04 is 3 working days.
const dates = { start_date: "2026-11-02", end_date: "2026-11-04", reason: "" };

describe.skipIf(!url)("leave types are independent (US-08, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 2, onnotice: () => {} });
  const manager = randomUUID();
  const employee = randomUUID();

  const balances = async () => {
    const rows = await sql<{ leave_type_id: string; balance: string }[]>`
      select leave_type_id, balance::text as balance from public.leave_balances
      where user_id = ${employee}`;
    return Object.fromEntries(rows.map((r) => [r.leave_type_id, r.balance]));
  };

  beforeAll(async () => {
    await sql`
      insert into public.users (id, name, email, role, manager_id) values
        (${manager}, 'Test Manager', ${`mgr-${manager}@test.example`}, 'manager', null)`;
    await sql`
      insert into public.users (id, name, email, role, manager_id) values
        (${employee}, 'Test Employee', ${`emp-${employee}@test.example`}, 'employee', ${manager})`;
    await sql`
      insert into public.leave_balances (user_id, leave_type_id, balance) values
        (${employee}, ${VAC}, 10), (${employee}, ${SICK}, 5)`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC1: approving a Sick request decrements only Sick; Vacation and Unpaid are unchanged", async () => {
    const { request } = await createLeaveRequest(sql, employee, { leave_type_id: SICK, ...dates });
    await decideLeaveRequest(sql, manager, request.id, { decision: "approve" });

    const after = await balances();
    expect(after[SICK]).toBe("2.00");
    expect(after[VAC]).toBe("10.00");
    expect(after[UNPAID]).toBeUndefined();
  });

  it("AC2: Unpaid can be requested and approved with no balance, and no balance row appears", async () => {
    const before = await balances();
    const { request, warnings } = await createLeaveRequest(sql, employee, {
      leave_type_id: UNPAID,
      ...dates,
    });
    expect(warnings).toEqual([]);

    const result = await decideLeaveRequest(sql, manager, request.id, { decision: "approve" });
    expect(result.balance).toBeNull();
    expect(await balances()).toEqual(before);
  });
});
