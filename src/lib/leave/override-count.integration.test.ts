import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getOverrideCount, getOverrideQueue } from "@/lib/leave/override-queue";

/**
 * TASK-059 against a real database: the HR dashboard's count must equal the override queue's
 * total (and so what `overrideLeaveRequest` accepts). Skipped unless TEST_DATABASE_URL is set; use
 * a THROWAWAY database. The count is HR-wide, so other files' rows move it: this file asserts
 * deltas around its own inserts, and must not run at the same time as another file that inserts
 * over-balance requests.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const UNPAID = "10000000-0000-4000-8000-000000000003";

describe.skipIf(!url)("override count agrees with the queue (TASK-059, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 2, onnotice: () => {} });
  const hr = randomUUID();
  const manager = randomUUID();

  async function employee(vac: number | null) {
    const id = randomUUID();
    await sql`
      insert into public.users (id, name, email, role, manager_id)
      values (${id}, ${`T-Count ${id.slice(0, 6)}`}, ${`${id}@test.example`}, 'employee', ${manager})`;
    if (vac !== null) {
      await sql`insert into public.leave_balances (user_id, leave_type_id, balance) values (${id}, ${VAC}, ${vac})`;
    }
    return id;
  }
  // 2026-11-02 is a Monday: Nov 2 to Nov 6 is 5 working days.
  async function request(userId: string, type = VAC) {
    const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
      values (${userId}, ${type}, '2026-11-02', '2026-11-06', '') returning id`;
    return row?.id ?? "";
  }
  const both = async () => ({
    count: await getOverrideCount(sql, hr),
    total: (await getOverrideQueue(sql, hr)).total,
  });

  beforeAll(async () => {
    await sql`
      insert into public.users (id, name, email, role, manager_id) values
        (${hr}, 'Count HR', ${`hr-${hr}@test.example`}, 'hr_admin', null),
        (${manager}, 'Count Manager', ${`mg-${manager}@test.example`}, 'manager', ${hr})`;
    await sql`insert into public.leave_balances (user_id, leave_type_id, balance) values (${hr}, ${VAC}, 1)`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it("counts exactly an over-balance request and agrees with the queue's total", async () => {
    const before = await both();
    expect(before.count).toBe(before.total);

    await request(await employee(3)); // 5 days against 3: over balance, counted
    const after = await both();
    expect(after.count - before.count).toBe(1);
    expect(after.count).toBe(after.total);
  });

  it("does not count an in-balance, negative-balance, Unpaid, no-row, or the caller's own request", async () => {
    const before = await both();

    await request(await employee(5)); // exactly enough: not over
    await request(await employee(10)); // plenty
    const negative = await employee(1);
    await sql`update public.leave_balances set balance = -2 where user_id = ${negative}`;
    await request(negative); // negative: HR cannot override it
    await request(await employee(0), UNPAID); // Unpaid does not track a balance
    await request(await employee(null)); // no balance row
    await request(hr); // HR's own request is never theirs to override

    const after = await both();
    expect(after.count).toBe(before.count);
    expect(after.count).toBe(after.total);
  });

  it("does not count a request that was soft-deleted", async () => {
    const before = await both();
    const id = await request(await employee(1));
    expect((await both()).count - before.count).toBe(1);
    await sql`update public.leave_requests set is_deleted = true where id = ${id}`;
    const after = await both();
    expect(after.count).toBe(before.count);
    expect(after.count).toBe(after.total);
  });
});
