import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { overrideLeaveRequest } from "@/lib/leave/override";
import {
  getOverrideQueue,
  getRecentOverrides,
  OVERRIDE_QUEUE_LIMIT,
  RECENT_OVERRIDES_LIMIT,
} from "@/lib/leave/override-queue";
import { countWorkingDays } from "@/lib/leave/working-days";

/**
 * TASK-039 against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at a
 * THROWAWAY database with the migrations applied and NO seed data: the queue is HR-wide and capped
 * at 50, and the recent list at 10, so other people's rows would crowd out the ones asserted here.
 * The test inserts its own users, balances, requests and audit rows, which cannot be deleted
 * afterwards. Its rows ARE visible to the other HR-wide lists, so run it on its own database,
 * never alongside `dashboard-lists`. The cap tests come last and use far-future dates, so a rerun
 * on the same database is not crowded by them.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const UNPAID = "10000000-0000-4000-8000-000000000003";

const APPROVE = { decision: "approve" } as const;

const dayAfter = (iso: string, n = 1) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const firstSaturday = (iso: string) => {
  let d = iso;
  while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 6) d = dayAfter(d);
  return d;
};

describe.skipIf(!url)("HR override page reads (TASK-039, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 3, onnotice: () => {} });
  const hrA = randomUUID();
  const hrB = randomUUID();
  const marco = randomUUID(); // manager of team one
  const priya = randomUUID(); // manager of another team
  const names = new Map<string, string>();
  const mine = new Set<string>(); // request ids created by this file

  async function user(id: string, name: string, role: string, managerId: string | null) {
    names.set(id, name);
    await sql`
      insert into public.users (id, name, email, role, manager_id)
      values (${id}, ${name}, ${`${id}@test.example`}, ${role}::public.user_role, ${managerId})`;
  }

  /** A fresh employee so balances never interfere. */
  async function employee(
    managerId: string | null,
    vac: number | null,
    sick: number | null = null,
  ) {
    const id = randomUUID();
    await user(id, `T-Queue ${id.slice(0, 6)}`, "employee", managerId);
    if (vac !== null) {
      await sql`insert into public.leave_balances (user_id, leave_type_id, balance) values (${id}, ${VAC}, ${vac})`;
    }
    if (sick !== null) {
      await sql`insert into public.leave_balances (user_id, leave_type_id, balance) values (${id}, ${SICK}, ${sick})`;
    }
    return id;
  }

  /** A request; 2026-11-02 is a Monday, so Nov 2 to Nov 6 is 5 working days. */
  async function request(
    userId: string,
    o: {
      type?: string;
      start?: string;
      end?: string;
      status?: "pending" | "approved";
      deleted?: boolean;
      createdAt?: string;
    } = {},
  ) {
    const status = o.status ?? "pending";
    const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests
        (user_id, leave_type_id, start_date, end_date, status, decided_by, decided_at, is_deleted,
         created_at)
      values (${userId}, ${o.type ?? VAC}, ${o.start ?? "2026-11-02"}::date,
              ${o.end ?? "2026-11-06"}::date, ${status}::public.leave_status,
              ${status === "pending" ? null : marco}, ${status === "pending" ? null : sql`now()`},
              ${o.deleted ?? false}, ${o.createdAt ?? sql`now()`})
      returning id`;
    mine.add(row!.id);
    return row!.id;
  }

  /** The queue as `viewer` sees it, only this file's requests. */
  const queueFor = async (viewer: string) => {
    const queue = await getOverrideQueue(sql, viewer);
    return { ...queue, mine: queue.rows.filter((r) => mine.has(r.id)) };
  };

  beforeAll(async () => {
    await user(hrA, "T-Queue Hana", "hr_admin", null);
    await user(hrB, "T-Queue Sam", "hr_admin", null);
    await user(marco, "T-Queue Marco", "manager", hrA);
    await user(priya, "T-Queue Priya", "manager", hrA);
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC1: lists every team's over-balance request, and never the ones the route would refuse", async () => {
    const one = await employee(marco, 2, 8);
    const two = await employee(priya, 1);
    const sickEmp = await employee(marco, 9, 1);
    const listedOne = await request(one);
    const listedTwo = await request(two);
    const listedSick = await request(sickEmp, {
      type: SICK,
      start: "2026-11-02",
      end: "2026-11-04",
    });

    // HR's own request: listed for the OTHER HR Admin, never for its owner.
    await sql`insert into public.leave_balances (user_id, leave_type_id, balance) values (${hrA}, ${VAC}, 1)`;
    const hrOwn = await request(hrA);

    // Not listed: decided, deleted, within balance, untracked type, no balance row, negative balance.
    const decided = await employee(marco, 2);
    const decidedId = await request(decided, { status: "approved" });
    const gone = await employee(marco, 2);
    const goneId = await request(gone, { deleted: true });
    const within = await employee(marco, 5);
    const withinId = await request(within); // 5 days, 5 available
    const unpaid = await employee(marco, 0);
    // A balance row exists for Unpaid on purpose: only the tracks_balance filter keeps it out.
    await sql`insert into public.leave_balances (user_id, leave_type_id, balance) values (${unpaid}, ${UNPAID}, 0)`;
    const unpaidId = await request(unpaid, { type: UNPAID });
    const noRow = await employee(marco, null);
    const noRowId = await request(noRow);
    const negative = await employee(marco, -2);
    const negativeId = await request(negative);

    const forA = new Set((await queueFor(hrA)).mine.map((r) => r.id));
    expect(forA).toEqual(new Set([listedOne, listedTwo, listedSick]));
    for (const id of [hrOwn, decidedId, goneId, withinId, unpaidId, noRowId, negativeId]) {
      expect(forA.has(id), `${id} must not be listed`).toBe(false);
    }

    const forB = new Set((await queueFor(hrB)).mine.map((r) => r.id));
    expect(forB).toEqual(new Set([listedOne, listedTwo, listedSick, hrOwn]));
  });

  it("AC2: each row carries what HR needs: names, dates, days, balance, exact shortfall, reason", async () => {
    const elena = await employee(marco, 4.5);
    await sql`update public.users set name = 'T-Queue Elena' where id = ${elena}`;
    const id = await request(elena);
    await sql`update public.leave_requests set reason = 'Family trip' where id = ${id}`;

    const row = (await queueFor(hrA)).mine.find((r) => r.id === id)!;
    expect(row).toMatchObject({
      employee_name: "T-Queue Elena",
      manager_name: "T-Queue Marco",
      leave_type_name: "Vacation",
      start_date: "2026-11-02",
      end_date: "2026-11-06",
      reason: "Family trip",
      working_days: 5,
      balance: "4.50",
      shortfall: "0.50",
    });
  });

  it("AC2: an employee with no manager is listed with a null manager", async () => {
    const loner = await employee(null, 1);
    const id = await request(loner);
    const row = (await queueFor(hrA)).mine.find((r) => r.id === id)!;
    expect(row.manager_name).toBeNull();
  });

  it("AC1: the oldest request comes first", async () => {
    const e = await employee(marco, 0);
    const newer = await request(e, { createdAt: "2026-10-12T09:00:00Z" });
    const older = await request(e, { createdAt: "2026-10-10T09:00:00Z" });
    const middle = await request(e, { createdAt: "2026-10-11T09:00:00Z" });
    const order = (await queueFor(hrA)).mine
      .filter((r) => [newer, older, middle].includes(r.id))
      .map((r) => r.id);
    expect(order).toEqual([older, middle, newer]);
  });

  it("the SQL working-day count equals countWorkingDays, and a weekend-only request is not listed", async () => {
    const sat = firstSaturday("2097-03-01");
    const ranges: [string, string][] = [
      ["2097-03-04", "2097-03-04"],
      [sat, dayAfter(sat)], // Saturday and Sunday only
      [dayAfter(sat), dayAfter(sat, 2)], // Sunday and Monday
      ["2097-03-01", "2097-03-21"], // three weeks
      ["2097-02-27", "2097-03-02"], // across a month end
      ["2096-12-30", "2097-01-04"], // across a year end
      ["2096-02-28", "2096-03-01"], // a leap day
    ];
    const e = await employee(marco, 0);
    const ids = await Promise.all(ranges.map(([start, end]) => request(e, { start, end })));

    const expected = ranges.map(([start, end]) => countWorkingDays(start, end));
    expect(expected.some((n) => n === 0)).toBe(true); // the weekend-only range
    expect(expected.some((n) => n > 0)).toBe(true);

    const listed = new Map((await queueFor(hrA)).mine.map((r) => [r.id, r.working_days]));
    ranges.forEach((_, i) => {
      const id = ids[i]!;
      if (expected[i] === 0) expect(listed.has(id), `${ranges[i]} has no working days`).toBe(false);
      else expect(listed.get(id), `${ranges[i]}`).toBe(expected[i]);
    });
  });

  it("lists the same requests the TASK-038 route accepts: approving a listed one works and removes it", async () => {
    const e = await employee(marco, 2);
    const id = await request(e);
    expect((await queueFor(hrA)).mine.some((r) => r.id === id)).toBe(true);
    await overrideLeaveRequest(sql, hrA, id, APPROVE);
    expect((await queueFor(hrA)).mine.some((r) => r.id === id)).toBe(false);
  });

  it("recent overrides: only override_approved, newest first, with the shortfall and who approved", async () => {
    const first = await employee(marco, 2);
    const firstId = await request(first);
    await overrideLeaveRequest(sql, hrA, firstId, APPROVE);
    const second = await employee(priya, 1);
    const secondId = await request(second);
    await overrideLeaveRequest(sql, hrB, secondId, APPROVE);
    // An HR rejection is an ordinary rejected row: not listed here.
    const rejected = await employee(marco, 0);
    const rejectedId = await request(rejected);
    await overrideLeaveRequest(sql, hrA, rejectedId, { decision: "reject", note: "No cover" });

    const recent = await getRecentOverrides(sql);
    const ours = recent.filter(
      (o) => names.get(first) === o.employee_name || names.get(second) === o.employee_name,
    );
    expect(ours.map((o) => o.employee_name)).toEqual([names.get(second), names.get(first)]);
    expect(ours[0]).toMatchObject({
      approved_by_name: "T-Queue Sam",
      days_requested: "5.00",
      shortfall: "4.00",
      leave_type_name: "Vacation",
    });
    expect(ours[1]).toMatchObject({ approved_by_name: "T-Queue Hana", shortfall: "3.00" });
    expect(recent.some((o) => o.employee_name === names.get(rejected))).toBe(false);
    for (const o of recent) {
      expect(o).not.toHaveProperty("reason");
      expect(o).not.toHaveProperty("decision_note");
    }
  });

  it("recent overrides: a request cancelled later still shows (the audit log is the record)", async () => {
    const e = await employee(marco, 1);
    const id = await request(e);
    await overrideLeaveRequest(sql, hrA, id, APPROVE);
    await sql`update public.leave_requests set is_deleted = true where id = ${id}`;
    const recent = await getRecentOverrides(sql);
    expect(recent.some((o) => o.employee_name === names.get(e))).toBe(true);
  });

  it("the queue is capped at 50 oldest-first and still reports the true total", async () => {
    const heavy = await employee(marco, 0);
    // Far-future dates and created_at: they sort last, so a rerun is not crowded out by them.
    for (let i = 0; i < OVERRIDE_QUEUE_LIMIT + 1; i += 1) {
      await request(heavy, {
        start: "2098-06-01",
        end: "2098-06-05",
        createdAt: "2099-01-01T00:00:00Z",
      });
    }
    const queue = await getOverrideQueue(sql, hrA);
    expect(queue.rows).toHaveLength(OVERRIDE_QUEUE_LIMIT);
    expect(queue.total).toBeGreaterThanOrEqual(OVERRIDE_QUEUE_LIMIT + 1);
    const times = queue.rows.map((r) => r.created_at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("recent overrides are capped at 10", async () => {
    const e = await employee(marco, 1);
    const id = await request(e);
    await overrideLeaveRequest(sql, hrA, id, APPROVE);
    for (let i = 0; i < RECENT_OVERRIDES_LIMIT; i += 1) {
      await sql`
        insert into public.audit_log
          (leave_request_id, actor_id, action, days_requested, balance_before, shortfall)
        values (${id}, ${hrA}, 'override_approved', 5, 1, 4)`;
    }
    expect(await getRecentOverrides(sql)).toHaveLength(RECENT_OVERRIDES_LIMIT);
  });
});
