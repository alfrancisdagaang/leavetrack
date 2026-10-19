import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decideLeaveRequest } from "@/lib/leave/decide";
import { notifyLeaveEvent } from "@/lib/leave/notify";
import { overrideLeaveRequest } from "@/lib/leave/override";
import { createLeaveRequest } from "@/lib/leave/service";

/**
 * EPIC-9 / TASK-053 against a real database: each leave event writes its notifications in the SAME
 * transaction, to exactly the right people. Skipped unless TEST_DATABASE_URL is set; point it at a
 * THROWAWAY database (requests, audit rows and notifications cannot be deleted). Every read is
 * scoped to this file's own users, and the failure trigger below fires only for this file's own
 * recipients, so other gated files can run beside it. It inserts over-balance pending requests, so,
 * like `override.integration`, it must not run at the same time as `override-count.integration`
 * (an HR-wide count that other files' rows move).
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const approve = { decision: "approve" } as const;
const reject = { decision: "reject", note: "No cover" } as const;
const days = (start: string, end: string) => ({
  leave_type_id: VAC,
  start_date: start,
  end_date: end,
  reason: "",
});

describe.skipIf(!url)("events write their notifications (TASK-053, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 2, onnotice: () => {} });
  const hr = randomUUID();
  const mgr = randomUUID(); // Marco
  const mgrOther = randomUUID(); // the other team's manager
  const emp = randomUUID(); // Elena, under mgr, balance 10
  const empOther = randomUUID(); // Leo, under mgrOther
  const empShort = randomUUID(); // under mgr, balance 1: a 3-day request is over balance
  const empUnderHr = randomUUID(); // whose manager_id is an HR admin
  const mgrFail = randomUUID();
  const empFail = randomUUID(); // balance 1
  const fn = `test_fail_notify_${randomUUID().replaceAll("-", "")}`;

  const kinds = async (requestId: string) =>
    (
      await sql<{ recipient_id: string; kind: string }[]>`
        select recipient_id, kind from public.notifications
        where leave_request_id = ${requestId} order by recipient_id, kind`
    ).sort((a, b) => a.recipient_id.localeCompare(b.recipient_id));
  const to = (recipient: string, kind: string) => ({ recipient_id: recipient, kind });
  const sorted = (...rows: { recipient_id: string; kind: string }[]) =>
    rows.sort((a, b) => a.recipient_id.localeCompare(b.recipient_id));
  const countFor = async (recipient: string) =>
    (
      await sql<{ n: number }[]>`
        select count(*)::int as n from public.notifications where recipient_id = ${recipient}`
    )[0]!.n;

  async function pending(userId: string, start: string, end: string) {
    const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
      values (${userId}, ${VAC}, ${start}, ${end}, '') returning id`;
    return row!.id;
  }
  const people = async (userId: string) =>
    (
      await sql<{ requests: number; audits: number }[]>`
        select (select count(*)::int from public.leave_requests where user_id = ${userId}) as requests,
               (select count(*)::int from public.audit_log a
                join public.leave_requests r on r.id = a.leave_request_id
                where r.user_id = ${userId}) as audits`
    )[0]!;
  const balanceOf = async (userId: string) =>
    (
      await sql<{ balance: string }[]>`
        select balance::text from public.leave_balances
        where user_id = ${userId} and leave_type_id = ${VAC}`
    )[0]!.balance;
  const failOn = (...ids: string[]) =>
    sql.unsafe(`
      create or replace function public.${fn}() returns trigger language plpgsql as $$
      begin raise exception 'forced notification failure' using errcode = 'P0001'; end; $$;
      create trigger ${fn} before insert on public.notifications
        for each row when (new.recipient_id in (${ids.map((i) => `'${i}'`).join(",")}))
        execute function public.${fn}();`);
  const failOff = () =>
    sql.unsafe(`drop trigger if exists ${fn} on public.notifications;
                drop function if exists public.${fn}();`);

  beforeAll(async () => {
    await sql`
      insert into public.users (id, name, email, role, manager_id) values
        (${hr}, 'Test HR', ${`hr-${hr}@test.example`}, 'hr_admin', null),
        (${mgr}, 'Test Marco', ${`mg-${mgr}@test.example`}, 'manager', ${hr}),
        (${mgrOther}, 'Other Mgr', ${`mo-${mgrOther}@test.example`}, 'manager', ${hr}),
        (${mgrFail}, 'Fail Mgr', ${`mf-${mgrFail}@test.example`}, 'manager', ${hr})`;
    await sql`
      insert into public.users (id, name, email, role, manager_id) values
        (${emp}, 'Test Elena', ${`el-${emp}@test.example`}, 'employee', ${mgr}),
        (${empOther}, 'Test Leo', ${`le-${empOther}@test.example`}, 'employee', ${mgrOther}),
        (${empShort}, 'Short Emp', ${`se-${empShort}@test.example`}, 'employee', ${mgr}),
        (${empUnderHr}, 'Under HR', ${`uh-${empUnderHr}@test.example`}, 'employee', ${hr}),
        (${empFail}, 'Fail Emp', ${`fe-${empFail}@test.example`}, 'employee', ${mgrFail})`;
    await sql`
      insert into public.leave_balances (user_id, leave_type_id, balance) values
        (${emp}, ${VAC}, 10), (${empOther}, ${VAC}, 10), (${empShort}, ${VAC}, 1),
        (${empUnderHr}, ${VAC}, 10), (${empFail}, ${VAC}, 1)`;
  });

  afterAll(async () => {
    await failOff();
    await sql.end();
  });

  it("AC1: submitting notifies the employee's manager and nobody else", async () => {
    const { request } = await createLeaveRequest(sql, emp, days("2026-11-02", "2026-11-03"));
    expect(await kinds(request.id)).toEqual([to(mgr, "submitted")]);
    // The employee, the HR admin and the other team's manager heard nothing.
    expect(await countFor(emp)).toBe(0);
    expect(await countFor(hr)).toBe(0);
    expect(await countFor(mgrOther)).toBe(0);
  });

  it("AC1: another team's submit goes to that team's manager, never to Marco", async () => {
    const before = await countFor(mgr);
    const { request } = await createLeaveRequest(sql, empOther, days("2026-11-02", "2026-11-03"));
    expect(await kinds(request.id)).toEqual([to(mgrOther, "submitted")]);
    expect(await countFor(mgr)).toBe(before);
  });

  it("an employee whose manager_id is an HR admin notifies nobody (nobody there can approve)", async () => {
    const { request } = await createLeaveRequest(sql, empUnderHr, days("2026-11-02", "2026-11-03"));
    expect(await kinds(request.id)).toEqual([]);
    expect(await countFor(hr)).toBe(0);
  });

  it("AC2: approving notifies the employee only", async () => {
    const id = await pending(emp, "2026-11-09", "2026-11-10");
    await decideLeaveRequest(sql, mgr, id, approve);
    expect(await kinds(id)).toEqual([to(emp, "approved")]);
  });

  it("AC2: rejecting notifies the employee only", async () => {
    const id = await pending(emp, "2026-11-16", "2026-11-17");
    await decideLeaveRequest(sql, mgr, id, reject);
    expect(await kinds(id)).toEqual([to(emp, "rejected")]);
  });

  it("AC2: a refused decision (another team's manager) writes nothing", async () => {
    const id = await pending(emp, "2026-11-23", "2026-11-24");
    await expect(decideLeaveRequest(sql, mgrOther, id, approve)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await kinds(id)).toEqual([]);
  });

  it("AC3: an override notifies the employee and their manager, not the HR admin who acted", async () => {
    const id = await pending(empShort, "2026-11-02", "2026-11-04"); // 3 days against 1
    await overrideLeaveRequest(sql, hr, id, approve);
    expect(await kinds(id)).toEqual(sorted(to(empShort, "overridden"), to(mgr, "overridden")));
    expect(await countFor(hr)).toBe(0);
  });

  it("an HR rejection notifies the employee only", async () => {
    const other = randomUUID();
    await sql`
      insert into public.users (id, name, email, role, manager_id)
      values (${other}, 'Short Two', ${`s2-${other}@test.example`}, 'employee', ${mgr})`;
    await sql`
      insert into public.leave_balances (user_id, leave_type_id, balance)
      values (${other}, ${VAC}, 1)`;
    const id = await pending(other, "2026-11-02", "2026-11-04");
    await overrideLeaveRequest(sql, hr, id, reject);
    expect(await kinds(id)).toEqual([to(other, "rejected")]);
  });

  it("AC5: the actor is never a recipient, even when asked to notify the manager", async () => {
    const id = await pending(emp, "2026-12-07", "2026-12-08");
    await sql.begin((tx) =>
      notifyLeaveEvent(tx, {
        kind: "submitted",
        requestId: id,
        employeeId: emp,
        actorId: mgr, // the manager is the actor
        toEmployee: false,
        toManager: true,
      }),
    );
    expect(await kinds(id)).toEqual([]);
    await sql.begin((tx) =>
      notifyLeaveEvent(tx, {
        kind: "approved",
        requestId: id,
        employeeId: emp,
        actorId: emp, // the employee is the actor
        toEmployee: true,
        toManager: false,
      }),
    );
    expect(await kinds(id)).toEqual([]);
  });

  it("AC4: a failed notification rolls the whole submit back", async () => {
    await failOn(mgrFail, empFail);
    try {
      const before = await people(empFail);
      await expect(
        createLeaveRequest(sql, empFail, days("2026-11-02", "2026-11-03")),
      ).rejects.toBeDefined();
      expect(await people(empFail)).toEqual(before);
    } finally {
      await failOff();
    }
  });

  it("AC4: a failed notification rolls the whole decision back (status, balance, audit)", async () => {
    const id = await pending(empFail, "2026-11-09", "2026-11-09"); // 1 day against 1
    await failOn(mgrFail, empFail);
    try {
      const before = await people(empFail);
      await expect(decideLeaveRequest(sql, mgrFail, id, approve)).rejects.toBeDefined();
      expect(await people(empFail)).toEqual(before);
      const [row] = await sql<{ status: string }[]>`
        select status from public.leave_requests where id = ${id}`;
      expect(row!.status).toBe("pending");
      expect(await balanceOf(empFail)).toBe("1.00");
    } finally {
      await failOff();
    }
    // The same decision succeeds once the failure is gone, so the rollback was the only obstacle.
    await decideLeaveRequest(sql, mgrFail, id, approve);
    expect(await kinds(id)).toEqual([to(empFail, "approved")]);
  });

  it("AC4: a failed notification rolls the whole override back (status, balance, audit)", async () => {
    const id = await pending(empFail, "2026-11-16", "2026-11-18"); // 3 days against 0 left
    await sql`update public.leave_balances set balance = 1
              where user_id = ${empFail} and leave_type_id = ${VAC}`;
    await failOn(mgrFail, empFail);
    try {
      const before = await people(empFail);
      await expect(overrideLeaveRequest(sql, hr, id, approve)).rejects.toBeDefined();
      expect(await people(empFail)).toEqual(before);
      const [row] = await sql<{ status: string }[]>`
        select status from public.leave_requests where id = ${id}`;
      expect(row!.status).toBe("pending");
      expect(await balanceOf(empFail)).toBe("1.00");
    } finally {
      await failOff();
    }
  });
});
