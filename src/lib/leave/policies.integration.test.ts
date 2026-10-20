import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAccrual } from "@/lib/leave/accrual";
import {
  getPolicyChoices,
  getPolicyPage,
  getRecentPolicyChanges,
  policyLockKey,
  RECENT_CHANGES,
  setPolicyRate,
} from "@/lib/leave/policies";
import { DEFAULT_POLICY_QUERY, POLICY_PAGE_SIZE } from "@/lib/leave/policies-schema";

/**
 * EPIC-13 (TASK-071) against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at a
 * THROWAWAY database with the migrations applied: the test inserts its own people, which are never
 * deleted (policy changes and accrual ledger rows cannot be). The accrual test runs the REAL monthly
 * accrual, which credits EVERY policy in the database, so run this file alone and on a database where
 * no other gated file's policies matter. Every person is created here with a random id and every
 * result is judged on ids this file planted. The tests share state and run in order.
 *
 *   hr, hr2 (hr_admin)   mgr (manager)   other (employee under mgr)
 *   emp ("Pol Elena")    30 more employees "PolPage 01".."30" (paging)   odd ("Pol 100% _Odd")
 */
const url = process.env.TEST_DATABASE_URL;
const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const UNPAID = "10000000-0000-4000-8000-000000000003";

describe.skipIf(!url)("leave policies (EPIC-13 TASK-071, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 6, onnotice: () => {} });
  const id = () => randomUUID();
  // A fresh prefix per run, so a rerun on the same database never matches the people of an earlier run.
  const P = `Pol${randomUUID().slice(0, 8)}`;
  const hr = id();
  const hr2 = id();
  const mgr = id();
  const other = id();
  const emp = id();
  const odd = id();
  const paged = Array.from({ length: 30 }, id);

  async function user(uid: string, name: string, role: string, manager: string | null) {
    await sql`
      insert into public.users (id, name, email, role, manager_id)
      values (${uid}, ${name}, ${`${uid}@test.example`}, ${role}::public.user_role, ${manager})`;
  }
  const count = async (table: "leave_policies" | "leave_policy_changes") =>
    (
      await sql<{ n: number }[]>`
        select count(*)::int as n from ${sql("public." + table)}`
    )[0]!.n;
  const changesFor = (uid: string) =>
    sql<{ old_rate: string | null; new_rate: string; changed_by: string; leave_type_id: string }[]>`
      select old_rate::text, new_rate::text, changed_by, leave_type_id
      from public.leave_policy_changes where user_id = ${uid} order by changed_at, id`;
  const rateOf = async (uid: string, type: string) =>
    (
      await sql<{ r: string }[]>`
        select accrual_per_month::text as r from public.leave_policies
        where user_id = ${uid} and leave_type_id = ${type}`
    )[0]?.r ?? null;
  const read = (over: Partial<Parameters<typeof getPolicyPage>[1]> & { viewerId: string }) =>
    getPolicyPage(sql, { ...DEFAULT_POLICY_QUERY, timeZone: "UTC", ...over });
  const set = (actor: string, uid: string, type: string, rate: string) =>
    setPolicyRate(sql, { actorId: actor, userId: uid, leaveTypeId: type, rate });
  const rejection = (p: Promise<unknown>) =>
    p.then(
      () => null,
      (e: unknown) => e as { code?: string; message: string },
    );

  beforeAll(async () => {
    await user(hr, `${P} HR`, "hr_admin", null);
    await user(hr2, `${P} HR Two`, "hr_admin", null);
    await user(mgr, `${P} Manager`, "manager", null);
    await user(other, `${P} Other`, "employee", mgr);
    await user(emp, `${P} Elena`, "employee", mgr);
    await user(odd, `${P} 100% _Odd`, "employee", mgr);
    for (const [i, p] of paged.entries())
      await user(p, `${P}Page ${String(i + 1).padStart(2, "0")}`, "employee", mgr);
  });
  afterAll(async () => {
    await sql.end();
  });

  describe("AC1: HR sees employees with their rates", () => {
    it("lists employees only, with Vacation and Sick (never Unpaid) and no rate yet", async () => {
      const page = await read({ viewerId: hr, q: `${P} Elena`, page: 1 });
      expect(page.total).toBe(1);
      const person = page.people[0]!;
      expect(person.id).toBe(emp);
      expect(person.rates.map((r) => r.leaveTypeName)).toEqual(["Vacation", "Sick"]);
      expect(person.rates.every((r) => r.rate === null)).toBe(true);
      expect(person.rates.map((r) => r.leaveTypeId)).not.toContain(UNPAID);
    });

    it("never lists a manager or an HR Admin", async () => {
      const everyone = await read({ viewerId: hr, q: P, page: 1 });
      const ids = everyone.people.map((p) => p.id);
      for (const nobody of [hr, hr2, mgr]) expect(ids).not.toContain(nobody);
      expect((await read({ viewerId: hr, q: `${P} Manager`, page: 1 })).total).toBe(0);
    });

    it("returns only id, name, manager name, last change and the rates: no email", async () => {
      const page = await read({ viewerId: hr, q: `${P} Elena`, page: 1 });
      expect(Object.keys(page.people[0]!).sort()).toEqual([
        "id",
        "lastChange",
        "managerName",
        "name",
        "rates",
      ]);
      expect(JSON.stringify(page)).not.toContain("@test.example");
    });

    it("an employee, a manager and an unknown viewer get nothing, where HR gets something", async () => {
      for (const viewer of [emp, mgr, id()]) {
        const page = await read({ viewerId: viewer, q: undefined, page: 1 });
        expect(page.total).toBe(0);
        expect(page.people).toEqual([]);
        expect(await getRecentPolicyChanges(sql, viewer)).toEqual([]);
      }
      expect((await read({ viewerId: hr, q: `${P} Elena`, page: 1 })).total).toBe(1);
    });

    it("the search is a literal part of the name: % and _ are not wildcards", async () => {
      expect(
        (await read({ viewerId: hr, q: `${P} 100%`, page: 1 })).people.map((p) => p.id),
      ).toEqual([odd]);
      expect((await read({ viewerId: hr, q: `${P} 100% _`, page: 1 })).total).toBe(1);
      expect((await read({ viewerId: hr, q: `${P}%Elena`, page: 1 })).total).toBe(0);
      expect((await read({ viewerId: hr, q: `${P} elena`, page: 1 })).total).toBe(1);
    });

    it("pages 25 at a time, counts the total before the cut and clamps a page past the end", async () => {
      const first = await read({ viewerId: hr, q: `${P}Page`, page: 1 });
      expect(first.total).toBe(30);
      expect(first.people).toHaveLength(POLICY_PAGE_SIZE);
      const second = await read({ viewerId: hr, q: `${P}Page`, page: 2 });
      expect(second.people).toHaveLength(5);
      const past = await read({ viewerId: hr, q: `${P}Page`, page: 99 });
      expect(past.page).toBe(2);
      expect(past.people.map((p) => p.id)).toEqual(second.people.map((p) => p.id));
      const all = [...first.people, ...second.people].map((p) => p.id);
      expect(new Set(all).size).toBe(30);
    });
  });

  describe("AC2: HR edits a rate and the change is recorded with it", () => {
    it("creates a policy for an employee who has none, recording a null old rate and the actor", async () => {
      const r = await set(hr, emp, VAC, "1.25");
      expect(r).toMatchObject({ status: "changed", oldRate: null, newRate: "1.25" });
      expect(r.changedByName).toBe(`${P} HR`);
      expect(new Date(r.changedAt ?? "").getTime()).toBeGreaterThan(Date.now() - 60_000);
      expect(await rateOf(emp, VAC)).toBe("1.25");
      expect(await changesFor(emp)).toEqual([
        { old_rate: null, new_rate: "1.25", changed_by: hr, leave_type_id: VAC },
      ]);
      const page = await read({ viewerId: hr, q: `${P} Elena`, page: 1 });
      expect(page.people[0]!.rates.map((x) => x.rate)).toEqual(["1.25", null]);
    });

    it("updates it, recording the old and the new rate, and another HR Admin may too", async () => {
      expect(await set(hr2, emp, VAC, "1.50")).toMatchObject({
        status: "changed",
        oldRate: "1.25",
        newRate: "1.50",
        changedByName: `${P} HR Two`,
      });
      expect(await rateOf(emp, VAC)).toBe("1.50");
      expect((await changesFor(emp)).at(-1)).toEqual({
        old_rate: "1.25",
        new_rate: "1.50",
        changed_by: hr2,
        leave_type_id: VAC,
      });
    });

    it("an unchanged rate writes nothing (not even a change row), whatever its spelling", async () => {
      const before = (await changesFor(emp)).length;
      expect(await set(hr, emp, VAC, "1.50")).toMatchObject({ status: "unchanged" });
      expect(await set(hr, emp, VAC, "1.5")).toMatchObject({ status: "unchanged" });
      expect((await changesFor(emp)).length).toBe(before);
    });

    it("a rate of 0 is allowed (it stops accrual), and each type is its own policy", async () => {
      expect((await set(hr, emp, SICK, "0.00")).status).toBe("changed");
      expect(await rateOf(emp, SICK)).toBe("0.00");
      expect(await rateOf(emp, VAC)).toBe("1.50");
    });

    it("a write waits while another change to the same rate is in progress, and goes through after", async () => {
      const key = policyLockKey(paged[0]!, SICK);
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      let locked!: () => void;
      const gotLock = new Promise<void>((r) => (locked = r));
      const holder = sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtext(${key}))`;
        locked();
        await held;
      });
      await gotLock;

      let finished = false;
      const write = set(hr, paged[0]!, SICK, "4.00").then((r) => {
        finished = true;
        return r;
      });
      await new Promise((r) => setTimeout(r, 400));
      expect(finished, "the write must wait for the lock").toBe(false);
      expect(await rateOf(paged[0]!, SICK)).toBeNull();

      release();
      await holder;
      expect(await write).toMatchObject({ status: "changed", oldRate: null, newRate: "4.00" });
      expect(await rateOf(paged[0]!, SICK)).toBe("4.00");
    });

    it("two HR Admins changing the same rate at once leave a consistent chain of old and new rates", async () => {
      await set(hr, other, VAC, "1.00");
      await Promise.all([set(hr, other, VAC, "2.00"), set(hr2, other, VAC, "3.00")]);
      const chain = (await changesFor(other)).map((c) => [c.old_rate, c.new_rate]);
      expect(chain).toHaveLength(3);
      expect(chain[0]).toEqual([null, "1.00"]);
      // each change's old rate is the previous change's new rate: nothing was recorded from a stale read
      expect(chain[1]![0]).toBe(chain[0]![1]);
      expect(chain[2]![0]).toBe(chain[1]![1]);
      expect(await rateOf(other, VAC)).toBe(chain[2]![1]);
    });
  });

  describe("AC3 and AC4: refusals change nothing", () => {
    const snapshot = async () => ({
      policies: await count("leave_policies"),
      changes: await count("leave_policy_changes"),
    });

    it("an employee or a manager as the actor is refused in the SQL and nothing is written", async () => {
      const before = await snapshot();
      for (const actor of [emp, mgr, id()]) {
        const err = await rejection(set(actor, other, SICK, "9.00"));
        expect(err).toMatchObject({ code: "FORBIDDEN" });
      }
      expect(await snapshot()).toEqual(before);
      expect(await rateOf(other, SICK)).toBeNull();
    });

    it("a manager, an HR Admin, an unknown person, Unpaid and an unknown type are all the same not-found", async () => {
      const before = await snapshot();
      const targets: [string, string][] = [
        [mgr, VAC],
        [hr2, VAC],
        [id(), VAC],
        [emp, UNPAID],
        [emp, id()],
      ];
      for (const [target, type] of targets) {
        const err = await rejection(set(hr, target, type, "1.00"));
        expect(err, `${target} ${type}`).toMatchObject({ code: "NOT_FOUND" });
      }
      expect(await snapshot()).toEqual(before);
    });

    it("the database refuses a rate above 31 or below 0 even if the app did not", async () => {
      const before = await snapshot();
      for (const bad of ["32.00", "-1.00"]) {
        await expect(set(hr, emp, SICK, bad)).rejects.toThrow();
      }
      expect(await snapshot()).toEqual(before);
      expect(await rateOf(emp, SICK)).toBe("0.00");
    });
  });

  describe("the table: sort, filters, summary and last change (EPIC-13 phase 1)", () => {
    const mgr2 = id();
    const [s1, s2, s3, s4, s5] = [id(), id(), id(), id(), id()] as [
      string,
      string,
      string,
      string,
      string,
    ];
    const mine = { q: `${P}S` };
    const names = async (over: Partial<Parameters<typeof read>[0]>) =>
      (await read({ viewerId: hr, ...mine, ...over })).people.map((p) => p.name.slice(P.length));

    beforeAll(async () => {
      await user(mgr2, `${P} Manager Two`, "manager", null);
      for (const [uid, n, m] of [
        [s1, "S1", mgr],
        [s2, "S2", mgr],
        [s3, "S3", mgr],
        [s4, "S4", mgr2],
        [s5, "S5", mgr2],
      ] as const)
        await user(uid, `${P}${n}`, "employee", m);
      // rates, set one at a time so each change has its own time (S4 is never touched)
      await set(hr, s1, VAC, "1.00");
      await set(hr, s1, SICK, "3.00");
      await set(hr, s2, VAC, "2.50");
      await set(hr, s3, SICK, "1.00");
      await set(hr, s5, VAC, "2.50");
      await set(hr, s5, SICK, "0.50");
    });

    it("orders by name, either way, with the id as the last tie-break", async () => {
      expect(await names({ sort: "name", dir: "asc" })).toEqual(["S1", "S2", "S3", "S4", "S5"]);
      expect(await names({ sort: "name", dir: "desc" })).toEqual(["S5", "S4", "S3", "S2", "S1"]);
    });

    it("orders by the Vacation rate with empty rates last in both directions and ties by name", async () => {
      expect(await names({ sort: "vacation", dir: "asc" })).toEqual(["S1", "S2", "S5", "S3", "S4"]);
      expect(await names({ sort: "vacation", dir: "desc" })).toEqual([
        "S2",
        "S5",
        "S1",
        "S3",
        "S4",
      ]);
    });

    it("orders by the Sick rate with empty rates last in both directions", async () => {
      expect(await names({ sort: "sick", dir: "asc" })).toEqual(["S5", "S3", "S1", "S2", "S4"]);
      expect(await names({ sort: "sick", dir: "desc" })).toEqual(["S1", "S3", "S5", "S2", "S4"]);
    });

    it("orders by when the rate was last changed, 'never' last in both directions", async () => {
      expect(await names({ sort: "changed", dir: "asc" })).toEqual(["S1", "S2", "S3", "S5", "S4"]);
      expect(await names({ sort: "changed", dir: "desc" })).toEqual(["S5", "S3", "S2", "S1", "S4"]);
    });

    it("pages stay disjoint and complete under a sort full of ties", async () => {
      const first = await read({ viewerId: hr, q: `${P}Page`, sort: "vacation", page: 1 });
      const second = await read({ viewerId: hr, q: `${P}Page`, sort: "vacation", page: 2 });
      const ids = [...first.people, ...second.people].map((p) => p.id);
      expect(ids).toHaveLength(30);
      expect(new Set(ids).size).toBe(30);
    });

    it("the page size is 25, 50 or 100 and the total does not depend on it", async () => {
      for (const per of [25, 50, 100] as const) {
        const page = await read({ viewerId: hr, q: `${P}Page`, per });
        expect(page.total).toBe(30);
        expect(page.pageSize).toBe(per);
        expect(page.people).toHaveLength(Math.min(30, per));
      }
      const past = await read({ viewerId: hr, q: `${P}Page`, per: 25, page: 99 });
      expect(past.page).toBe(2);
      expect(past.people).toHaveLength(5);
    });

    it("filters by team: only that manager's employees", async () => {
      expect(await names({ team: mgr })).toEqual(["S1", "S2", "S3"]);
      expect(await names({ team: mgr2 })).toEqual(["S4", "S5"]);
      expect(await names({ team: id() })).toEqual([]);
    });

    it("filters by status: no policy (missing any rate), has a policy, changed this month", async () => {
      expect(await names({ status: "none" })).toEqual(["S2", "S3", "S4"]);
      expect(await names({ status: "has" })).toEqual(["S1", "S5"]);
      expect(await names({ status: "changed" })).toEqual(["S1", "S2", "S3", "S5"]);
    });

    it("a leave type narrows the rates shown and what 'no policy' means", async () => {
      expect(await names({ type: SICK, status: "none" })).toEqual(["S2", "S4"]);
      expect(await names({ type: VAC, status: "none" })).toEqual(["S3", "S4"]);
      const sickOnly = await read({ viewerId: hr, ...mine, type: SICK });
      expect(
        sickOnly.people.every((p) => p.rates.length === 1 && p.rates[0]!.leaveTypeId === SICK),
      ).toBe(true);
      expect(await names({ type: VAC, status: "changed", team: mgr })).toEqual(["S1", "S2"]);
    });

    it("shows each person's manager and the newest change to any of their rates", async () => {
      const page = await read({ viewerId: hr, ...mine, sort: "name" });
      const by = Object.fromEntries(page.people.map((p) => [p.name.slice(P.length), p]));
      expect(by.S1!.managerName).toBe(`${P} Manager`);
      expect(by.S4!.managerName).toBe(`${P} Manager Two`);
      expect(by.S4!.lastChange).toBeNull();
      const [newest] = await sql<{ at: Date }[]>`
        select max(changed_at) as at from public.leave_policy_changes where user_id = ${s1}`;
      expect(by.S1!.lastChange).toEqual({ at: newest!.at.toISOString(), by: `${P} HR` });
    });

    it("the summary is company-wide: the search and the filters do not change it, and it is true", async () => {
      const open = await read({ viewerId: hr });
      const narrow = await read({ viewerId: hr, q: `${P}S1`, team: mgr, status: "has" });
      expect(narrow.summary).toEqual(open.summary);
      const [truth] = await sql<{ employees: number; none: number; changed: number }[]>`
        select count(*)::int as employees,
               count(*) filter (where exists (select 1 from public.leave_types lt
                 where lt.tracks_balance and not exists (select 1 from public.leave_policies lp
                   where lp.user_id = u.id and lp.leave_type_id = lt.id)))::int as none,
               count(*) filter (where exists (select 1 from public.leave_policy_changes c
                 where c.user_id = u.id and c.changed_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'))::int as changed
        from public.users u where u.role = 'employee'`;
      expect(open.summary).toEqual({
        employees: truth!.employees,
        noPolicy: truth!.none,
        changedThisMonth: truth!.changed,
      });
    });

    it("an employee, a manager and an unknown viewer get no rows and an empty summary", async () => {
      for (const viewer of [emp, mgr, id()]) {
        const page = await read({ viewerId: viewer });
        expect(page.people).toEqual([]);
        expect(page.summary).toEqual({ employees: 0, noPolicy: 0, changedThisMonth: 0 });
      }
    });

    it("the filter choices are the managers with employees and the leave types that accrue, for HR only", async () => {
      const choices = await getPolicyChoices(sql, hr);
      const ids = choices.managers.map((m) => m.id);
      expect(ids).toEqual(expect.arrayContaining([mgr, mgr2]));
      expect(ids).not.toContain(hr);
      expect(choices.leaveTypes.map((t) => t.name)).toEqual(["Sick", "Vacation"]);
      expect(choices.leaveTypes.map((t) => t.id)).not.toContain(UNPAID);
      for (const viewer of [emp, mgr, id()])
        expect(await getPolicyChoices(sql, viewer)).toEqual({ managers: [], leaveTypes: [] });
    });
  });

  describe("AC6: the record is append-only and HR sees the latest", () => {
    it("a change row cannot be updated, deleted or truncated", async () => {
      await expect(
        sql`update public.leave_policy_changes set new_rate = 9 where user_id = ${emp}`,
      ).rejects.toThrow(/append-only/);
      await expect(
        sql`delete from public.leave_policy_changes where user_id = ${emp}`,
      ).rejects.toThrow(/append-only/);
      await expect(sql`truncate public.leave_policy_changes`).rejects.toThrow(/append-only/);
    });

    it("the recent list is newest first, at most 10, with names and rates, for HR only", async () => {
      for (let i = 1; i <= RECENT_CHANGES + 2; i++) await set(hr, odd, VAC, `${i}.00`);
      const recent = await getRecentPolicyChanges(sql, hr);
      expect(recent).toHaveLength(RECENT_CHANGES);
      expect(recent[0]).toMatchObject({
        employeeName: `${P} 100% _Odd`,
        leaveTypeName: "Vacation",
        changedByName: `${P} HR`,
        newRate: `${RECENT_CHANGES + 2}.00`,
      });
      const times = recent.map((r) => r.changedAt);
      expect([...times].sort().reverse()).toEqual(times);
      expect(await getRecentPolicyChanges(sql, mgr)).toEqual([]);
    });
  });

  describe("AC5: a new rate is used from the next accrual, and accrual stays idempotent (runs last)", () => {
    it("credits the current rate, never rewrites an accrued month, and uses the new rate next month", async () => {
      const [row] = await sql<{ latest: string | null }[]>`
        select to_char(max(period), 'YYYY-MM-DD') as latest from public.accrual_ledger`;
      const latest = row?.latest ?? null;
      const first = latest ? new Date(`${latest}T00:00:00Z`) : new Date(Date.UTC(2041, 4, 1));
      if (latest) first.setUTCMonth(first.getUTCMonth() + 1);
      const m1 = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 15));
      const m2 = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 15));
      const period = (d: Date) =>
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
      const credited = async (uid: string, type: string) =>
        await sql<{ period: string; amount: string }[]>`
            select to_char(period, 'YYYY-MM-DD') as period, amount::text from public.accrual_ledger
            where user_id = ${uid} and leave_type_id = ${type} order by period`;
      const balance = async (uid: string, type: string) =>
        (
          await sql<{ b: string }[]>`
            select balance::text as b from public.leave_balances
            where user_id = ${uid} and leave_type_id = ${type}`
        )[0]?.b ?? null;

      // emp's Vacation rate is 1.50 and odd's is the last loop value; give emp a fresh known one
      await set(hr, emp, VAC, "2.00");
      await runAccrual(sql, m1);
      expect(await credited(emp, VAC)).toEqual([{ period: period(m1), amount: "2.00" }]);
      expect(await balance(emp, VAC)).toBe("2.00");

      // a second run for the same month credits nothing more (idempotent)
      await runAccrual(sql, m1);
      expect(await credited(emp, VAC)).toHaveLength(1);
      expect(await balance(emp, VAC)).toBe("2.00");

      // changing the rate does not rewrite the month already accrued, even if accrual runs again
      await set(hr, emp, VAC, "5.00");
      await runAccrual(sql, m1);
      expect(await credited(emp, VAC)).toEqual([{ period: period(m1), amount: "2.00" }]);
      expect(await balance(emp, VAC)).toBe("2.00");

      // a policy created for someone who had none is credited for the CURRENT month on the next run (once)
      const late = paged[1]!;
      await set(hr, late, VAC, "3.00");
      await runAccrual(sql, m1);
      await runAccrual(sql, m1);
      expect(await credited(late, VAC)).toEqual([{ period: period(m1), amount: "3.00" }]);
      expect(await balance(late, VAC)).toBe("3.00");

      // the next month uses the new rate, and no back-pay is added for the earlier month
      await runAccrual(sql, m2);
      expect(await credited(emp, VAC)).toEqual([
        { period: period(m1), amount: "2.00" },
        { period: period(m2), amount: "5.00" },
      ]);
      expect(await balance(emp, VAC)).toBe("7.00");
    });
  });
});
