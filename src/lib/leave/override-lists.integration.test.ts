import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getOverrideChoices,
  getOverriddenPage,
  getOverrideQueuePage,
} from "@/lib/leave/override-lists";
import { DEFAULT_OVERRIDE_QUERY, type OverrideListQuery } from "@/lib/leave/override-list-schema";
import { getOverrideCount, getOverrideQueue } from "@/lib/leave/override-queue";

/**
 * EPIC-14 (Balance Overrides at scale) against a real database. Skipped unless TEST_DATABASE_URL is set. Point
 * it at a THROWAWAY database with the migrations applied (requests, audit rows and balances are never deleted).
 * The HR lists are company-wide, so other gated files' rows are visible: every assertion about rows is judged on
 * names carrying this run's tag, and the company-wide numbers are compared with a direct count. The names carry a
 * per-run tag, so a rerun on the same database never matches the people of an earlier run.
 *
 *   mgrA ── W (the waiting cases and the sort group)      mgrB ── B (another team, waiting)
 *   hr ── H (HR's OWN over-balance request: never listed)   O group ── already overridden (audit rows)
 */
const url = process.env.TEST_DATABASE_URL;
const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const UNPAID = "10000000-0000-4000-8000-000000000003";

describe.skipIf(!url)("override lists (EPIC-14, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 4, onnotice: () => {} });
  const id = () => randomUUID();
  const P = `Ov${randomUUID().slice(0, 8)}`;
  const hr = id();
  const hr2 = id();
  const mgrA = id();
  const mgrB = id();
  const nobody = id();

  const waiting = (over: Partial<OverrideListQuery> & { hrId?: string } = {}) =>
    getOverrideQueuePage(sql, { ...DEFAULT_OVERRIDE_QUERY, hrId: hr, ...over });
  /**
   * The HR lists are company-wide and other gated files insert rows while this one runs, so a comparison
   * between two reads (or a read and a count) must see ONE snapshot of the database.
   */
  const snapshot = <T>(fn: (tx: Sql) => Promise<T>) =>
    sql.begin("isolation level repeatable read read only", (tx) =>
      fn(tx as unknown as Sql),
    ) as Promise<T>;
  const done = (over: Partial<OverrideListQuery> & { hrId?: string; timeZone?: string } = {}) =>
    getOverriddenPage(sql, {
      ...DEFAULT_OVERRIDE_QUERY,
      view: "overridden",
      sort: "approved",
      dir: "desc",
      hrId: hr,
      timeZone: "UTC",
      ...over,
    });
  const wn = async (over: Partial<OverrideListQuery> = {}) =>
    (await waiting({ q: P, ...over })).rows.map((r) => r.employee_name.slice(P.length + 1));
  const dn = async (over: Partial<OverrideListQuery> = {}) =>
    (await done({ q: P, ...over })).rows.map((r) => r.employee_name.slice(P.length + 1));

  async function user(uid: string, name: string, role: string, manager: string | null) {
    await sql`insert into public.users (id, name, email, role, manager_id)
              values (${uid}, ${name}, ${`${uid}@test.example`}, ${role}::public.user_role, ${manager})`;
  }
  /** One employee with a balance and a pending request created at `createdAt`. */
  async function waitingCase(
    name: string,
    manager: string | null,
    type: string,
    bal: number | null,
    start: string,
    end: string,
    createdAt = "2026-09-01T00:00:00Z",
    reason = "",
  ) {
    const uid = id();
    await user(uid, `${P} ${name}`, "employee", manager);
    if (bal !== null)
      await sql`insert into public.leave_balances (user_id, leave_type_id, balance)
                values (${uid}, ${type}, ${bal})`;
    const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, created_at)
      values (${uid}, ${type}, ${start}, ${end}, ${reason}, ${createdAt}::timestamptz) returning id`;
    return row!.id;
  }
  /** An already approved request with its override audit row. */
  async function overridden(
    name: string,
    manager: string | null,
    type: string,
    start: string,
    end: string,
    days: number,
    balanceBefore: number,
    at: string,
  ) {
    const uid = id();
    await user(uid, `${P} ${name}`, "employee", manager);
    const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests
        (user_id, leave_type_id, start_date, end_date, status, decided_by, decided_at)
      values (${uid}, ${type}, ${start}, ${end}, 'approved', ${hr}, ${at}::timestamptz) returning id`;
    await sql`insert into public.audit_log
                (leave_request_id, actor_id, action, occurred_at, days_requested, balance_before, shortfall)
              values (${row!.id}, ${hr}, 'override_approved'::public.audit_action, ${at}::timestamptz,
                      ${days}, ${balanceBefore}, ${days - balanceBefore})`;
    return row!.id;
  }

  const ids: Record<string, string> = {};

  beforeAll(async () => {
    await user(hr, `${P} HR`, "hr_admin", null);
    await user(hr2, `${P} HR Two`, "hr_admin", null);
    await user(mgrA, `${P} Manager A`, "manager", null);
    await user(mgrB, `${P} Manager B`, "manager", null);
    await user(nobody, `${P} Nobody`, "employee", mgrA);

    // Waiting (over balance): shortfall = working days - balance
    ids.over1 = await waitingCase("W Over by 1", mgrA, VAC, 2, "2026-11-02", "2026-11-04"); // 3 days, bal 2 → 1
    ids.over3 = await waitingCase("W Over by 3", mgrA, VAC, 0, "2026-11-02", "2026-11-04"); // → 3
    ids.sick = await waitingCase("W Sick over", mgrA, SICK, 1, "2026-11-02", "2026-11-04"); // → 2
    ids.teamB = await waitingCase("B Other team", mgrB, VAC, 1, "2026-11-02", "2026-11-04"); // → 2
    ids.noMgr = await waitingCase("W No manager", null, VAC, 0, "2026-11-09", "2026-11-09"); // 1 day → 1
    // NOT waiting: enough balance, exactly enough, negative, no record, untracked, weekend-only, own request
    await waitingCase("X Enough", mgrA, VAC, 10, "2026-11-02", "2026-11-04");
    await waitingCase("X Exact", mgrA, VAC, 3, "2026-11-02", "2026-11-04");
    await waitingCase("X Negative", mgrA, VAC, -1, "2026-11-02", "2026-11-04");
    await waitingCase("X No record", mgrA, VAC, null, "2026-11-02", "2026-11-04");
    await waitingCase("X Unpaid", mgrA, UNPAID, 0, "2026-11-02", "2026-11-04");
    await waitingCase("X Weekend", mgrA, VAC, 0, "2026-11-07", "2026-11-08");
    const hrOwn = await waitingCase("H HR Own", null, VAC, 0, "2026-11-02", "2026-11-04");
    await sql`update public.leave_requests set user_id = ${hr} where id = ${hrOwn}`; // HR's OWN request
    await sql`insert into public.leave_balances (user_id, leave_type_id, balance)
              values (${hr}, ${VAC}, 0) on conflict do nothing`;
    // a decided request and a soft-deleted pending one never wait
    const gone = await waitingCase("X Deleted", mgrA, VAC, 0, "2026-11-02", "2026-11-04");
    await sql`update public.leave_requests set is_deleted = true where id = ${gone}`;

    // S group: sort tests (all over balance). names Dora Alan Cleo Ben; created order S1<S2<S3<S4
    //   start: Cleo 11-02 < Dora 11-09 < Ben 11-16 < Alan 11-23     days: Dora 5, Alan 1, Cleo 3, Ben 3
    //   shortfall (balance 0): equals days → Dora 5, Alan 1, Cleo 3, Ben 3 (ties on Cleo and Ben)
    for (const [n, a, b, c] of [
      ["S Dora", "2026-11-09", "2026-11-13", "2026-09-11T00:00:00Z"],
      ["S Alan", "2026-11-23", "2026-11-23", "2026-09-12T00:00:00Z"],
      ["S Cleo", "2026-11-02", "2026-11-04", "2026-09-13T00:00:00Z"],
      ["S Ben", "2026-11-16", "2026-11-18", "2026-09-14T00:00:00Z"],
    ] as const)
      await waitingCase(n, mgrA, VAC, 0, a, b, c);
    await waitingCase("S Dates", mgrA, VAC, 0, "2027-03-10", "2027-03-12", "2026-09-15T00:00:00Z");

    // Pg group: 30 waiting
    for (let i = 1; i <= 30; i++)
      await waitingCase(
        `Pg ${String(i).padStart(2, "0")}`,
        mgrA,
        VAC,
        0,
        "2027-06-07",
        "2027-06-08",
        `2026-08-${String(i).padStart(2, "0")}T00:00:00Z`,
      );

    // O group: overridden. shortfall = days - balance_before
    ids.o1 = await overridden(
      "O One",
      mgrA,
      VAC,
      "2026-12-01",
      "2026-12-03",
      3,
      1,
      "2026-10-01T10:00:00Z",
    ); // 2
    ids.o2 = await overridden(
      "O Two",
      mgrB,
      SICK,
      "2026-12-08",
      "2026-12-12",
      5,
      0,
      "2026-10-03T10:00:00Z",
    ); // 5
    ids.o3 = await overridden(
      "O Three",
      mgrA,
      VAC,
      "2026-12-15",
      "2026-12-16",
      2,
      0.5,
      "2026-10-02T10:00:00Z",
    ); // 1.5
    ids.o4 = await overridden(
      "O Four",
      null,
      VAC,
      "2027-01-04",
      "2027-01-05",
      2,
      1,
      new Date().toISOString(),
    ); // 1, today
  });
  afterAll(async () => {
    await sql.end();
  });

  describe("what waits is exactly what an override can act on", () => {
    it("lists the over-balance requests and none of the others (enough, exact, negative, no record, untracked, weekend, HR's own, deleted)", async () => {
      const got = new Set(await wn({ per: 100 }));
      for (const n of ["W Over by 1", "W Over by 3", "W Sick over", "B Other team", "W No manager"])
        expect(got.has(n), n).toBe(true);
      for (const n of [
        "X Enough",
        "X Exact",
        "X Negative",
        "X No record",
        "X Unpaid",
        "X Weekend",
        "H HR Own",
        "X Deleted",
      ])
        expect(got.has(n), n).toBe(false);
    });

    it("unfiltered, its total is the dashboard's count and the old queue's total", async () => {
      const [page, count, old] = await snapshot(
        async (tx) =>
          [
            await getOverrideQueuePage(tx, { ...DEFAULT_OVERRIDE_QUERY, hrId: hr }),
            await getOverrideCount(tx, hr),
            await getOverrideQueue(tx, hr),
          ] as const,
      );
      expect(page.total).toBe(count);
      expect(page.total).toBe(old.total);
      expect(page.summary.waiting).toBe(page.total);
    });

    it("HR's own request is not listed for HR, but is for the other HR Admin", async () => {
      // the request belongs to `hr` now, so it is found by HR's own name
      expect((await waiting({ q: `${P} HR` })).total).toBe(0);
      const other = await waiting({ hrId: hr2, q: `${P} HR` });
      expect(other.total).toBe(1);
      expect(other.rows[0]!.employee_name).toBe(`${P} HR`);
    });

    it("an employee, a manager and an unknown viewer get nothing, with an empty summary", async () => {
      for (const viewer of [nobody, mgrA, id()]) {
        const page = await waiting({ hrId: viewer });
        expect(page.total).toBe(0);
        expect(page.rows).toEqual([]);
        expect(page.summary).toEqual({ waiting: 0, biggestShortfall: null, oldestDays: null });
        expect((await done({ hrId: viewer })).total).toBe(0);
        expect(await getOverrideChoices(sql, viewer)).toEqual({ leaveTypes: [], managers: [] });
      }
    });

    it("a row carries the shortfall, the balance, the manager and the reason, as before", async () => {
      const page = await waiting({ q: `${P} W Over by 3` });
      expect(page.rows[0]).toMatchObject({
        employee_name: `${P} W Over by 3`,
        manager_name: `${P} Manager A`,
        leave_type_name: "Vacation",
        working_days: 3,
        balance: "0.00",
        shortfall: "3.00",
      });
      expect(page.rows[0]!.created_at).toBeInstanceOf(Date);
    });
  });

  describe("filters", () => {
    it("the search is a literal part of the name", async () => {
      expect((await waiting({ q: `${P} w over` })).total).toBe(2);
      expect((await waiting({ q: `${P}%Over` })).total).toBe(0);
      expect((await waiting({ q: `${P}_W` })).total).toBe(0);
    });

    it("filters by leave type, and by team (the employee's manager)", async () => {
      expect(await wn({ type: SICK })).toEqual(["W Sick over"]);
      expect(await wn({ team: mgrB })).toEqual(["B Other team"]);
      const a = await wn({ team: mgrA, per: 100 });
      expect(a).toContain("W Over by 1");
      expect(a).not.toContain("B Other team");
      expect(a).not.toContain("W No manager");
      expect(await wn({ team: id() })).toEqual([]);
    });

    it("a date range matches a request whose dates overlap it, edges included", async () => {
      const dates = (from?: string, to?: string) => wn({ q: `${P} S Dates`, from, to });
      expect(await dates("2027-03-12")).toEqual(["S Dates"]);
      expect(await dates("2027-03-13")).toEqual([]);
      expect(await dates(undefined, "2027-03-10")).toEqual(["S Dates"]);
      expect(await dates(undefined, "2027-03-09")).toEqual([]);
    });
  });

  describe("sort and paging", () => {
    const S = { q: `${P} S ` };
    it("orders by when it was submitted, either way", async () => {
      expect(await wn({ ...S, sort: "created", dir: "asc" })).toEqual([
        "S Dora",
        "S Alan",
        "S Cleo",
        "S Ben",
        "S Dates",
      ]);
      expect(await wn({ ...S, sort: "created", dir: "desc" })).toEqual([
        "S Dates",
        "S Ben",
        "S Cleo",
        "S Alan",
        "S Dora",
      ]);
    });
    it("orders by the days over the balance, the biggest first by default, ties by submission", async () => {
      expect(await wn({ q: `${P} S `, sort: "shortfall", dir: "desc" })).toEqual([
        "S Dora",
        "S Cleo",
        "S Ben",
        "S Dates",
        "S Alan",
      ]);
      expect(await wn({ q: `${P} S `, sort: "shortfall", dir: "asc" })).toEqual([
        "S Alan",
        "S Cleo",
        "S Ben",
        "S Dates",
        "S Dora",
      ]);
    });
    it("orders by leave start, name and working days", async () => {
      expect((await wn({ ...S, sort: "start", dir: "asc" })).slice(0, 4)).toEqual([
        "S Cleo",
        "S Dora",
        "S Ben",
        "S Alan",
      ]);
      expect((await wn({ ...S, sort: "name", dir: "asc" })).slice(0, 4)).toEqual([
        "S Alan",
        "S Ben",
        "S Cleo",
        "S Dates",
      ]);
      expect((await wn({ ...S, sort: "days", dir: "desc" }))[0]).toBe("S Dora");
    });

    it("pages 25 at a time, counts the total before the cut, clamps a page past the end and keeps pages disjoint", async () => {
      const first = await waiting({ q: `${P} Pg` });
      expect(first.total).toBe(30);
      expect(first.rows).toHaveLength(25);
      const second = await waiting({ q: `${P} Pg`, page: 2 });
      expect(second.rows).toHaveLength(5);
      const past = await waiting({ q: `${P} Pg`, page: 99 });
      expect(past.page).toBe(2);
      expect(past.rows.map((r) => r.id)).toEqual(second.rows.map((r) => r.id));
      const ids2 = [...first.rows, ...second.rows].map((r) => r.id);
      expect(new Set(ids2).size).toBe(30);
      for (const per of [50, 100] as const) {
        const page = await waiting({ q: `${P} Pg`, per });
        expect(page.pageSize).toBe(per);
        expect(page.rows).toHaveLength(30);
      }
    });

    it("HR can reach every waiting request: there is no cap of 50", async () => {
      const all = await waiting({ per: 100 });
      expect(all.total).toBeGreaterThan(30);
      const last = await waiting({ per: 25, page: Math.ceil(all.total / 25) });
      expect(last.rows.length).toBeGreaterThan(0);
    });
  });

  describe("the summary ignores the filters and is true", () => {
    it("counts everything waiting, the biggest shortfall and the oldest wait", async () => {
      const { open, narrow, truth } = await snapshot(async (tx) => {
        const open = await getOverrideQueuePage(tx, { ...DEFAULT_OVERRIDE_QUERY, hrId: hr });
        const narrow = await getOverrideQueuePage(tx, {
          ...DEFAULT_OVERRIDE_QUERY,
          hrId: hr,
          q: `${P} Pg 01`,
          type: SICK,
          team: mgrB,
        });
        const [truth] = await tx<{ n: number; biggest: string }[]>`
        select count(*)::int as n, max(d.days - lb.balance)::text as biggest
        from public.leave_requests r
        join public.leave_types lt on lt.id = r.leave_type_id and lt.tracks_balance
        join public.leave_balances lb on lb.user_id = r.user_id and lb.leave_type_id = r.leave_type_id
        cross join lateral (select count(*)::int as days
          from generate_series(r.start_date::timestamp, r.end_date::timestamp, interval '1 day') g
          where extract(isodow from g) < 6) d
        where r.status = 'pending' and r.is_deleted = false and r.user_id <> ${hr}
          and lb.balance >= 0 and lb.balance < d.days`;
        return { open, narrow, truth };
      });
      expect(narrow.summary).toEqual(open.summary);
      expect(open.summary.waiting).toBe(truth!.n);
      expect(open.summary.biggestShortfall).toBe(truth!.biggest);
      expect(open.summary.oldestDays).toBeGreaterThan(0);
    });
  });

  describe("the overridden view", () => {
    it("lists the overrides newest first with the shortfall, who approved and when", async () => {
      const page = await done({ q: `${P} O ` });
      expect(page.rows.map((r) => r.employee_name.slice(P.length + 1))).toEqual([
        "O Four",
        "O Two",
        "O Three",
        "O One",
      ]);
      expect(page.rows.find((r) => r.employee_name.endsWith("O Two"))).toMatchObject({
        shortfall: "5.00",
        days_requested: "5.00",
        approved_by_name: `${P} HR`,
        leave_type_name: "Sick",
      });
      expect(page.rows[0]!.occurred_at).toBeInstanceOf(Date);
    });

    it("sorts by approval time, shortfall, name and leave start, either way", async () => {
      expect(await dn({ q: `${P} O `, sort: "approved", dir: "asc" })).toEqual([
        "O One",
        "O Three",
        "O Two",
        "O Four",
      ]);
      expect(await dn({ q: `${P} O `, sort: "shortfall" })).toEqual([
        "O Two",
        "O One",
        "O Three",
        "O Four",
      ]);
      expect(await dn({ q: `${P} O `, sort: "name", dir: "asc" })).toEqual([
        "O Four",
        "O One",
        "O Three",
        "O Two",
      ]);
      expect(await dn({ q: `${P} O `, sort: "start", dir: "asc" })).toEqual([
        "O One",
        "O Two",
        "O Three",
        "O Four",
      ]);
    });

    it("filters by search, leave type, team and leave dates", async () => {
      expect(await dn({ q: `${P} O T` })).toEqual(["O Two", "O Three"]);
      expect(await dn({ q: `${P} O `, type: SICK })).toEqual(["O Two"]);
      expect(await dn({ q: `${P} O `, team: mgrB })).toEqual(["O Two"]);
      expect(await dn({ q: `${P} O `, team: mgrA })).toEqual(["O Three", "O One"]);
      expect(await dn({ q: `${P} O `, from: "2026-12-15", to: "2026-12-16" })).toEqual(["O Three"]);
      expect(await dn({ q: `${P} O `, from: "2027-02-01" })).toEqual([]);
    });

    it("the summary is company-wide, ignores the filters and counts this month's approvals", async () => {
      const { open, narrow, truth } = await snapshot(async (tx) => {
        const base = {
          ...DEFAULT_OVERRIDE_QUERY,
          view: "overridden" as const,
          sort: "approved" as const,
          dir: "desc" as const,
          hrId: hr,
          timeZone: "UTC",
        };
        const open = await getOverriddenPage(tx, base);
        const narrow = await getOverriddenPage(tx, { ...base, q: `${P} O One`, team: mgrA });
        const [truth] = await tx<{ n: number; days: string; month: number }[]>`
        select count(*)::int as n, coalesce(sum(shortfall), 0)::text as days,
               count(*) filter (where occurred_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')::int as month
        from public.audit_log where action = 'override_approved'`;
        return { open, narrow, truth };
      });
      expect(narrow.summary).toEqual(open.summary);
      expect(open.summary).toEqual({
        total: truth!.n,
        totalShortfall: truth!.days,
        thisMonth: truth!.month,
      });
      expect(open.summary.thisMonth).toBeGreaterThanOrEqual(1);
    });

    it("pages with the same clamp", async () => {
      const page = await done({ q: `${P} O `, per: 25, page: 9 });
      expect(page.page).toBe(1);
      expect(page.rows).toHaveLength(4);
    });
  });

  it("the filter choices are the leave types that track a balance and the managers who have employees", async () => {
    const c = await getOverrideChoices(sql, hr);
    expect(c.leaveTypes.map((t) => t.name)).toEqual(["Sick", "Vacation"]);
    const mids = c.managers.map((m) => m.id);
    expect(mids).toEqual(expect.arrayContaining([mgrA, mgrB]));
    expect(mids).not.toContain(hr);
  });
});
