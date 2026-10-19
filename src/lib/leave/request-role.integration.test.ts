import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLeaveRequest } from "@/lib/leave/service";

/**
 * EPIC-10 (TASK-058) against a real database: only an employee can create a request, decided in
 * SQL from the users row. Skipped unless TEST_DATABASE_URL is set; point it at a THROWAWAY
 * database (leave requests cannot be hard-deleted afterwards).
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const dates = { start_date: "2026-11-02", end_date: "2026-11-04", reason: "" };

describe.skipIf(!url)("only employees request leave (EPIC-10, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 2, onnotice: () => {} });
  const hr = randomUUID();
  const manager = randomUUID();
  const employee = randomUUID();
  // A manager and an HR admin even WITH a manager and a balance row must be refused.
  const managerWithBoss = randomUUID();

  const counts = async (userId: string) => {
    const [row] = await sql<{ requests: number; audits: number }[]>`
      select
        (select count(*)::int from public.leave_requests where user_id = ${userId}) as requests,
        (select count(*)::int from public.audit_log a
           join public.leave_requests r on r.id = a.leave_request_id
          where r.user_id = ${userId}) as audits`;
    return row;
  };

  beforeAll(async () => {
    await sql`
      insert into public.users (id, name, email, role, manager_id) values
        (${hr}, 'Test HR', ${`hr-${hr}@test.example`}, 'hr_admin', null),
        (${manager}, 'Test Manager', ${`mgr-${manager}@test.example`}, 'manager', ${hr})`;
    await sql`
      insert into public.users (id, name, email, role, manager_id) values
        (${employee}, 'Test Employee', ${`emp-${employee}@test.example`}, 'employee', ${manager}),
        (${managerWithBoss}, 'Test Manager 2', ${`mg2-${managerWithBoss}@test.example`}, 'manager', ${hr})`;
    await sql`
      insert into public.leave_balances (user_id, leave_type_id, balance) values
        (${employee}, ${VAC}, 10), (${managerWithBoss}, ${VAC}, 10)`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC1: a manager (with an approver and a balance row) is refused and nothing is written", async () => {
    await expect(
      createLeaveRequest(sql, managerWithBoss, { leave_type_id: VAC, ...dates }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await counts(managerWithBoss)).toEqual({ requests: 0, audits: 0 });
  });

  it("AC1: a top-level HR admin is refused with FORBIDDEN, not 'no approver'", async () => {
    await expect(
      createLeaveRequest(sql, hr, { leave_type_id: VAC, ...dates }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await counts(hr)).toEqual({ requests: 0, audits: 0 });
  });

  it("AC3: an employee still gets a pending request and a submitted audit row", async () => {
    const { request } = await createLeaveRequest(sql, employee, { leave_type_id: VAC, ...dates });
    expect(request.status).toBe("pending");
    expect(await counts(employee)).toEqual({ requests: 1, audits: 1 });
  });

  it("a role change takes effect at once: the same user is refused after becoming a manager", async () => {
    const mover = randomUUID();
    await sql`
      insert into public.users (id, name, email, role, manager_id) values
        (${mover}, 'Test Mover', ${`mv-${mover}@test.example`}, 'employee', ${manager})`;
    await sql`insert into public.leave_balances (user_id, leave_type_id, balance) values (${mover}, ${VAC}, 10)`;
    await createLeaveRequest(sql, mover, { leave_type_id: VAC, ...dates });
    await sql`update public.users set role = 'manager' where id = ${mover}`;
    await expect(
      createLeaveRequest(sql, mover, { leave_type_id: VAC, ...dates }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await counts(mover))?.requests).toBe(1);
  });
});
