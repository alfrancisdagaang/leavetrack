import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decideLeaveRequest } from "@/lib/leave/decide";

/**
 * EPIC-10 (TASK-059) against a real database: only a manager decides a normal request, decided in
 * SQL from the users row. The strongest case is an HR admin who IS the `manager_id` of the
 * employee (the data still allows it): before this task that worked. Skipped unless
 * TEST_DATABASE_URL is set; point it at a THROWAWAY database (requests cannot be hard-deleted).
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const approve = { decision: "approve" } as const;

describe.skipIf(!url)("only managers decide normal requests (EPIC-10, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 2, onnotice: () => {} });
  const hr = randomUUID();
  const manager = randomUUID();
  const otherManager = randomUUID();
  const underHr = randomUUID(); // an employee whose manager_id is the HR admin
  const underManager = randomUUID();

  async function pendingFor(userId: string) {
    const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
      values (${userId}, ${VAC}, '2026-11-02', '2026-11-03', '') returning id`;
    return row?.id ?? "";
  }
  const state = async (id: string) => {
    const [row] = await sql<{ status: string; audits: number }[]>`
      select r.status, (select count(*)::int from public.audit_log a where a.leave_request_id = r.id) as audits
      from public.leave_requests r where r.id = ${id}`;
    return row;
  };

  beforeAll(async () => {
    await sql`
      insert into public.users (id, name, email, role, manager_id) values
        (${hr}, 'Test HR', ${`hr-${hr}@test.example`}, 'hr_admin', null),
        (${manager}, 'Test Manager', ${`mg-${manager}@test.example`}, 'manager', ${hr}),
        (${otherManager}, 'Other Manager', ${`om-${otherManager}@test.example`}, 'manager', ${hr})`;
    await sql`
      insert into public.users (id, name, email, role, manager_id) values
        (${underHr}, 'Under HR', ${`uh-${underHr}@test.example`}, 'employee', ${hr}),
        (${underManager}, 'Under Manager', ${`um-${underManager}@test.example`}, 'employee', ${manager})`;
    await sql`
      insert into public.leave_balances (user_id, leave_type_id, balance) values
        (${underHr}, ${VAC}, 10), (${underManager}, ${VAC}, 10)`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC1: an HR admin who is the employee's manager_id is refused; the request stays pending, no audit row", async () => {
    const id = await pendingFor(underHr);
    await expect(decideLeaveRequest(sql, hr, id, approve)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("Only managers"),
    });
    expect(await state(id)).toEqual({ status: "pending", audits: 0 });
  });

  it("AC4: the real manager still approves a direct report (balance down, audit row written)", async () => {
    const id = await pendingFor(underManager);
    const result = await decideLeaveRequest(sql, manager, id, approve);
    expect(result.request.status).toBe("approved");
    expect(await state(id)).toEqual({ status: "approved", audits: 1 });
  });

  it("AC4: a manager still cannot decide another team's request", async () => {
    const id = await pendingFor(underManager);
    await expect(decideLeaveRequest(sql, otherManager, id, approve)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("direct reports"),
    });
    expect((await state(id))?.status).toBe("pending");
  });

  it("a role change takes effect at once: the same user is refused after becoming an HR admin", async () => {
    const mover = randomUUID();
    await sql`
      insert into public.users (id, name, email, role, manager_id)
      values (${mover}, 'Mover', ${`mv-${mover}@test.example`}, 'manager', ${hr})`;
    const emp = randomUUID();
    await sql`
      insert into public.users (id, name, email, role, manager_id)
      values (${emp}, 'Mover Report', ${`mr-${emp}@test.example`}, 'employee', ${mover})`;
    await sql`insert into public.leave_balances (user_id, leave_type_id, balance) values (${emp}, ${VAC}, 10)`;
    const id = await pendingFor(emp);
    await sql`update public.users set role = 'hr_admin' where id = ${mover}`;
    await expect(decideLeaveRequest(sql, mover, id, approve)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect((await state(id))?.status).toBe("pending");
  });
});
