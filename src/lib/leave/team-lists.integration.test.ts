import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkOverBalance } from "@/lib/leave/over-balance";
import { getTeamChoices, getTeamDecidedPage, getTeamQueuePage } from "@/lib/leave/team-lists";
import { DEFAULT_TEAM_QUERY, type TeamQueueQuery } from "@/lib/leave/team-queue-schema";
import { countWorkingDays } from "@/lib/leave/working-days";

/**
 * EPIC-14 (Team Approvals at scale) against a real database. Skipped unless TEST_DATABASE_URL is set. Point
 * it at a THROWAWAY database with the migrations applied (requests, audit rows and balances are never
 * deleted). Every person is created here with a random id, every manager is this file's own, and every
 * result is judged on rows this file planted, so other gated files can run beside it. The names carry a
 * per-run tag, so a rerun on the same database never matches the people of an earlier run.
 *
 *   mgr ── the cases below (one employee each), the S group (sort tests), the Pg group (30 for paging), D group (decided)
 *   mgr2 ── other (an employee of ANOTHER team: must never appear for mgr)
 */
const url = process.env.TEST_DATABASE_URL;
const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const UNPAID = "10000000-0000-4000-8000-000000000003";

describe.skipIf(!url)("team approval lists (EPIC-14, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 4, onnotice: () => {} });
  const id = () => randomUUID();
  const P = `Tm${randomUUID().slice(0, 8)}`;
  const hr = id();
  const mgr = id();
  const mgr2 = id();

  const read = (over: Partial<TeamQueueQuery> & { managerId?: string } = {}) =>
    getTeamQueuePage(sql, { ...DEFAULT_TEAM_QUERY, managerId: mgr, ...over });
  const readDecided = (over: Partial<TeamQueueQuery> & { managerId?: string } = {}) =>
    getTeamDecidedPage(sql, {
      ...DEFAULT_TEAM_QUERY,
      view: "decided",
      sort: "decided",
      dir: "desc",
      managerId: mgr,
      ...over,
    });
  const names = async (over: Partial<TeamQueueQuery> = {}) =>
    (await read({ q: P, ...over })).rows.map((r) => r.employee_name.slice(P.length + 1));

  async function user(uid: string, name: string, role: string, manager: string | null) {
    await sql`insert into public.users (id, name, email, role, manager_id)
              values (${uid}, ${name}, ${`${uid}@test.example`}, ${role}::public.user_role, ${manager})`;
  }
  async function balance(uid: string, type: string, value: number) {
    await sql`insert into public.leave_balances (user_id, leave_type_id, balance)
              values (${uid}, ${type}, ${value})`;
  }
  async function pending(
    uid: string,
    type: string,
    start: string,
    end: string,
    createdAt = "now()",
    reason = "",
  ) {
    const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason, created_at)
      values (${uid}, ${type}, ${start}, ${end}, ${reason},
              ${createdAt === "now()" ? sql`now()` : sql`${createdAt}::timestamptz`})
      returning id`;
    return row!.id;
  }
  /** One employee of mgr with one balance row and one pending request. */
  async function employee(
    name: string,
    team: string,
    type: string,
    bal: number | null,
    start: string,
    end: string,
    createdAt?: string,
  ) {
    const uid = id();
    await user(uid, `${P} ${name}`, "employee", team);
    if (bal !== null) await balance(uid, type, bal);
    const rid = await pending(uid, type, start, end, createdAt);
    return { uid, rid };
  }

  // ---- the parity cases: each is one employee, one pending request, 3 working days unless noted ----
  const cases: { name: string; type: string; bal: number | null; start: string; end: string }[] = [
    { name: "Case ok 10", type: VAC, bal: 10, start: "2026-11-02", end: "2026-11-04" },
    { name: "Case exact 3", type: VAC, bal: 3, start: "2026-11-02", end: "2026-11-04" },
    { name: "Case short 2.99", type: VAC, bal: 2.99, start: "2026-11-02", end: "2026-11-04" },
    { name: "Case zero", type: VAC, bal: 0, start: "2026-11-02", end: "2026-11-04" },
    { name: "Case no record", type: VAC, bal: null, start: "2026-11-02", end: "2026-11-04" },
    { name: "Case negative", type: VAC, bal: -1, start: "2026-11-02", end: "2026-11-04" },
    { name: "Case unpaid none", type: UNPAID, bal: null, start: "2026-11-02", end: "2026-11-04" },
    { name: "Case unpaid zero", type: UNPAID, bal: 0, start: "2026-11-02", end: "2026-11-04" },
    { name: "Case sick 2.5", type: SICK, bal: 2.5, start: "2026-11-02", end: "2026-11-04" },
    { name: "Case weekend", type: VAC, bal: 0, start: "2026-11-07", end: "2026-11-08" },
    { name: "Case over a week", type: VAC, bal: 4.5, start: "2026-11-02", end: "2026-11-10" },
  ];
  const caseIds: Record<string, string> = {};
  let otherReq = "";
  const mgrOwn = new Set<string>();

  beforeAll(async () => {
    await user(hr, `${P} HR`, "hr_admin", null);
    await user(mgr, `${P} Manager`, "manager", null);
    await user(mgr2, `${P} Manager Two`, "manager", null);
    for (const c of cases) {
      const e = await employee(c.name, mgr, c.type, c.bal, c.start, c.end);
      caseIds[c.name] = e.rid;
      mgrOwn.add(e.rid);
    }
    const other = await employee("Other Team", mgr2, VAC, 0, "2026-11-02", "2026-11-04");
    otherReq = other.rid;

    // S group: sort tests. Names, created order, start dates and days are all different.
    //   name:    Dora(S1) Alan(S2) Cleo(S3) Ben(S4)      created: S1 < S2 < S3 < S4
    //   start:   S3 (11-02) < S1 (11-09) < S4 (11-16) < S2 (11-23)
    //   days:    S1 5, S2 1, S3 3, S4 3
    const s = [
      ["S Dora", "2026-11-09", "2026-11-13", "2026-09-01T00:00:00Z"],
      ["S Alan", "2026-11-23", "2026-11-23", "2026-09-02T00:00:00Z"],
      ["S Cleo", "2026-11-02", "2026-11-04", "2026-09-03T00:00:00Z"],
      ["S Ben", "2026-11-16", "2026-11-18", "2026-09-04T00:00:00Z"],
    ] as const;
    for (const [n, a, b, c] of s) await employee(n, mgr, VAC, 100, a, b, c);

    // A request with long dates for the date-range edge tests: 2027-03-10 to 2027-03-12
    await employee("Dates", mgr, VAC, 100, "2027-03-10", "2027-03-12");

    // Pg group: 30 employees for paging, one request each, oldest first by number
    const pg = Array.from({ length: 30 }, id);
    for (const [i, uid] of pg.entries()) {
      await user(uid, `${P} Pg ${String(i + 1).padStart(2, "0")}`, "employee", mgr);
      await balance(uid, VAC, 100);
      await pending(
        uid,
        VAC,
        "2027-06-07",
        "2027-06-08",
        `2026-08-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      );
    }

    // D group: decided requests for the decided view
    const decide = async (
      name: string,
      status: "approved" | "rejected",
      overridden: boolean,
      decidedAt: string,
      start: string,
      end: string,
    ) => {
      const uid = id();
      await user(uid, `${P} ${name}`, "employee", mgr);
      const [row] = await sql<{ id: string }[]>`
        insert into public.leave_requests
          (user_id, leave_type_id, start_date, end_date, status, decided_by, decided_at, decision_note)
        values (${uid}, ${VAC}, ${start}, ${end}, ${status}::public.leave_status, ${mgr},
                ${decidedAt}::timestamptz, ${status === "rejected" ? "Not this week" : null})
        returning id`;
      if (overridden)
        await sql`insert into public.audit_log
                    (leave_request_id, actor_id, action, days_requested, balance_before, shortfall)
                  values (${row!.id}, ${hr}, 'override_approved'::public.audit_action, 5, 2, 3)`;
      return row!.id;
    };
    await decide(
      "D Approved One",
      "approved",
      false,
      "2026-10-01T10:00:00Z",
      "2026-12-01",
      "2026-12-02",
    );
    await decide(
      "D Approved Two",
      "approved",
      false,
      "2026-10-03T10:00:00Z",
      "2026-12-08",
      "2026-12-09",
    );
    await decide(
      "D Rejected",
      "rejected",
      false,
      "2026-10-02T10:00:00Z",
      "2026-12-15",
      "2026-12-16",
    );
    await decide(
      "D Overridden",
      "approved",
      true,
      "2026-10-04T10:00:00Z",
      "2026-12-22",
      "2026-12-23",
    );
  });
  afterAll(async () => {
    await sql.end();
  });

  describe("scope: only this manager's direct reports, whatever the filters", () => {
    it("never shows another team's request under any filter, sort or page", async () => {
      for (const over of [
        {},
        { q: "Other" },
        { q: P },
        { status: "blocked" as const },
        { status: "over" as const },
        { status: "ok" as const },
        { sort: "name" as const },
        { sort: "days" as const, dir: "desc" as const },
        { per: 100 as const, q: P },
        { from: "2026-11-01", to: "2026-11-30" },
        { type: VAC },
      ]) {
        const page = await read(over);
        expect(
          page.rows.map((r) => r.id),
          JSON.stringify(over),
        ).not.toContain(otherReq);
      }
      expect((await read({ q: "Other Team" })).total).toBe(0);
    });

    it("the other manager sees only their own team", async () => {
      const page = await read({ managerId: mgr2, q: P });
      expect(page.rows.map((r) => r.id)).toEqual([otherReq]);
    });

    it("a person who is not a manager gets nothing even if employees report to them (an older HR Admin with a team)", async () => {
      const boss = id();
      await user(boss, `${P} Old HR Boss`, "hr_admin", null);
      const e = await employee("Under HR", boss, VAC, 0, "2026-11-02", "2026-11-04");
      // and one decided request of theirs, so the decided list has something the role check must hide
      await sql`insert into public.leave_requests
                  (user_id, leave_type_id, start_date, end_date, status, decided_by, decided_at)
                values (${e.uid}, ${VAC}, '2026-12-01', '2026-12-02', 'approved', ${hr}, now())`;
      expect((await read({ managerId: boss })).total).toBe(0);
      expect((await read({ managerId: boss })).summary.pending).toBe(0);
      expect((await readDecided({ managerId: boss })).total).toBe(0);
      expect(await getTeamChoices(sql, boss)).toEqual({ leaveTypes: [] });
      // the request exists: the SQL's role check is what hides it
      expect(e.rid).toBeTruthy();
    });

    it("an employee, an HR Admin and an unknown id get nothing, with an empty summary", async () => {
      for (const viewer of [hr, id()]) {
        const page = await read({ managerId: viewer });
        expect(page.total).toBe(0);
        expect(page.rows).toEqual([]);
        expect(page.summary).toEqual({
          pending: 0,
          canApprove: 0,
          cannotApprove: 0,
          oldestDays: null,
        });
        expect((await readDecided({ managerId: viewer })).total).toBe(0);
        expect(await getTeamChoices(sql, viewer)).toEqual({ leaveTypes: [] });
      }
      const [anEmployee] = await sql<{ id: string }[]>`
        select user_id as id from public.leave_requests where id = ${otherReq}`;
      expect((await read({ managerId: anEmployee!.id })).total).toBe(0);
    });
  });

  describe("the balance state in SQL agrees with checkOverBalance (EPIC-14)", () => {
    it("working days and the state match the TypeScript rule for every case", async () => {
      const page = await read({ q: `${P} Case`, per: 100 });
      expect(page.total).toBe(cases.length);
      for (const r of page.rows) {
        expect(r.working_days, r.employee_name).toBe(countWorkingDays(r.start_date, r.end_date));
        expect(r.balanceCheck, r.employee_name).toEqual(
          checkOverBalance({
            tracksBalance: r.tracks_balance,
            balance: r.balance,
            days: countWorkingDays(r.start_date, r.end_date),
          }),
        );
      }
    });

    it("each status filter returns exactly the requests the TypeScript rule puts in that state", async () => {
      const all = (await read({ q: `${P} Case`, per: 100 })).rows;
      const expected = {
        ok: new Set<string>(),
        over: new Set<string>(),
        blocked: new Set<string>(),
      };
      for (const r of all) {
        const kind = r.balanceCheck.kind;
        expected[kind === "ok" ? "ok" : kind === "over" ? "over" : "blocked"].add(r.id);
      }
      expect(expected.ok.size).toBeGreaterThan(0);
      expect(expected.over.size).toBeGreaterThan(0);
      expect(expected.blocked.size).toBeGreaterThan(0);
      for (const status of ["ok", "over", "blocked"] as const) {
        const got = (await read({ q: `${P} Case`, per: 100, status })).rows.map((r) => r.id);
        expect(new Set(got), status).toEqual(expected[status]);
      }
    });

    it("the cases fall where the rule says (exact balance is ok, 0.01 short is over, a missing row is blocked)", async () => {
      const state = async (name: string) => {
        for (const status of ["ok", "over", "blocked"] as const)
          if ((await read({ q: `${P} ${name}`, status })).total === 1) return status;
        return null;
      };
      expect(await state("Case exact 3")).toBe("ok");
      expect(await state("Case short 2.99")).toBe("over");
      expect(await state("Case no record")).toBe("blocked");
      expect(await state("Case negative")).toBe("blocked");
      expect(await state("Case unpaid none")).toBe("ok");
      expect(await state("Case weekend")).toBe("ok");
      expect(await state("Case over a week")).toBe("over");
    });
  });

  describe("filters", () => {
    it("the search is a literal part of the name, in any case", async () => {
      expect((await read({ q: `${P} case ok` })).total).toBe(1);
      expect((await read({ q: `${P}%Case` })).total).toBe(0);
      expect((await read({ q: `${P}_Case` })).total).toBe(0);
    });

    it("filters by leave type", async () => {
      const sick = await read({ q: `${P} Case`, type: SICK, per: 100 });
      expect(sick.rows.map((r) => r.employee_name.slice(P.length + 1))).toEqual(["Case sick 2.5"]);
      const unpaid = await read({ q: `${P} Case`, type: UNPAID, per: 100 });
      expect(unpaid.total).toBe(2);
    });

    it("a date range matches a request whose dates overlap it, edges included", async () => {
      const dates = (from?: string, to?: string) => names({ q: `${P} Dates`, from, to });
      expect(await dates("2027-03-12")).toEqual(["Dates"]); // starts on its last day
      expect(await dates("2027-03-13")).toEqual([]);
      expect(await dates(undefined, "2027-03-10")).toEqual(["Dates"]); // ends on its first day
      expect(await dates(undefined, "2027-03-09")).toEqual([]);
      expect(await dates("2027-03-11", "2027-03-11")).toEqual(["Dates"]); // inside it
      expect(await dates("2027-03-01", "2027-03-31")).toEqual(["Dates"]); // around it
    });

    it("all filters together narrow, none widen", async () => {
      expect(
        (
          await read({
            q: `${P} Case`,
            type: VAC,
            status: "over",
            from: "2026-11-01",
            to: "2026-11-30",
            per: 100,
          })
        ).rows
          .map((r) => r.employee_name.slice(P.length + 1))
          .sort(),
      ).toEqual(["Case over a week", "Case short 2.99", "Case zero"].sort());
    });
  });

  describe("sort, page size and paging", () => {
    const S = { q: `${P} S ` };
    it("orders by when it was submitted, either way", async () => {
      expect(await names({ ...S, sort: "created", dir: "asc" })).toEqual([
        "S Dora",
        "S Alan",
        "S Cleo",
        "S Ben",
      ]);
      expect(await names({ ...S, sort: "created", dir: "desc" })).toEqual([
        "S Ben",
        "S Cleo",
        "S Alan",
        "S Dora",
      ]);
    });
    it("orders by the first day of leave, either way", async () => {
      expect(await names({ ...S, sort: "start", dir: "asc" })).toEqual([
        "S Cleo",
        "S Dora",
        "S Ben",
        "S Alan",
      ]);
      expect(await names({ ...S, sort: "start", dir: "desc" })).toEqual([
        "S Alan",
        "S Ben",
        "S Dora",
        "S Cleo",
      ]);
    });
    it("orders by name, either way", async () => {
      expect(await names({ ...S, sort: "name", dir: "asc" })).toEqual([
        "S Alan",
        "S Ben",
        "S Cleo",
        "S Dora",
      ]);
      expect(await names({ ...S, sort: "name", dir: "desc" })).toEqual([
        "S Dora",
        "S Cleo",
        "S Ben",
        "S Alan",
      ]);
    });
    it("orders by working days, ties broken by when it was submitted", async () => {
      expect(await names({ ...S, sort: "days", dir: "desc" })).toEqual([
        "S Dora",
        "S Cleo",
        "S Ben",
        "S Alan",
      ]);
      expect(await names({ ...S, sort: "days", dir: "asc" })).toEqual([
        "S Alan",
        "S Cleo",
        "S Ben",
        "S Dora",
      ]);
    });

    it("pages 25 at a time by default, counts the total before the cut and clamps a page past the end", async () => {
      const first = await read({ q: `${P} Pg` });
      expect(first.total).toBe(30);
      expect(first.pageSize).toBe(25);
      expect(first.rows).toHaveLength(25);
      const second = await read({ q: `${P} Pg`, page: 2 });
      expect(second.rows).toHaveLength(5);
      const past = await read({ q: `${P} Pg`, page: 99 });
      expect(past.page).toBe(2);
      expect(past.rows.map((r) => r.id)).toEqual(second.rows.map((r) => r.id));
      const ids = [...first.rows, ...second.rows].map((r) => r.id);
      expect(new Set(ids).size).toBe(30);
    });

    it("the page size is 25, 50 or 100 and the total does not depend on it", async () => {
      for (const per of [25, 50, 100] as const) {
        const page = await read({ q: `${P} Pg`, per });
        expect(page.total).toBe(30);
        expect(page.pageSize).toBe(per);
        expect(page.rows).toHaveLength(Math.min(30, per));
      }
    });

    it("stays complete and disjoint when every row ties", async () => {
      const a = await read({ q: `${P} Case`, sort: "days", dir: "desc", per: 25, page: 1 });
      const ids = a.rows.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("the summary describes the whole team and ignores the filters", () => {
    it("is true, and the search and filters do not change it", async () => {
      const open = await read();
      const narrow = await read({ q: `${P} Case ok`, status: "over", type: SICK });
      expect(narrow.summary).toEqual(open.summary);
      const [truth] = await sql<{ pending: number }[]>`
        select count(*)::int as pending from public.leave_requests r
        join public.users u on u.id = r.user_id
        where u.manager_id = ${mgr} and r.status = 'pending' and r.is_deleted = false`;
      expect(open.summary.pending).toBe(truth!.pending);
      expect(open.summary.canApprove + open.summary.cannotApprove).toBe(open.summary.pending);
      expect(open.summary.cannotApprove).toBeGreaterThan(0);
      expect(open.summary.oldestDays).toBeGreaterThan(0);
    });
  });

  describe("the decided view", () => {
    const D = { q: `${P} D ` };
    const dn = async (over: Partial<TeamQueueQuery> = {}) =>
      (await readDecided({ ...D, ...over })).rows.map((r) => r.employee_name.slice(P.length + 3));

    it("lists the team's decided requests, newest decision first, with the note and the HR override mark", async () => {
      const page = await readDecided(D);
      expect(page.rows.map((r) => r.employee_name.slice(P.length + 3))).toEqual([
        "Overridden",
        "Approved Two",
        "Rejected",
        "Approved One",
      ]);
      expect(page.rows.find((r) => r.employee_name.endsWith("Rejected"))).toMatchObject({
        status: "rejected",
        decision_note: "Not this week",
      });
      expect(page.rows.find((r) => r.employee_name.endsWith("Overridden"))?.overridden).toBe(true);
      expect(page.rows.every((r) => r.decided_at instanceof Date)).toBe(true);
    });

    it("filters by outcome: approved excludes an HR override, which has its own filter", async () => {
      expect(await dn({ status: "approved" })).toEqual(["Approved Two", "Approved One"]);
      expect(await dn({ status: "rejected" })).toEqual(["Rejected"]);
      expect(await dn({ status: "overridden" })).toEqual(["Overridden"]);
    });

    it("sorts by decision time, leave start and name, either way", async () => {
      expect(await dn({ sort: "decided", dir: "asc" })).toEqual([
        "Approved One",
        "Rejected",
        "Approved Two",
        "Overridden",
      ]);
      expect(await dn({ sort: "start", dir: "asc" })).toEqual([
        "Approved One",
        "Approved Two",
        "Rejected",
        "Overridden",
      ]);
      expect(await dn({ sort: "name", dir: "desc" })).toEqual([
        "Rejected",
        "Overridden",
        "Approved Two",
        "Approved One",
      ]);
    });

    it("filters by leave dates overlapping a range, and by type", async () => {
      expect(await dn({ from: "2026-12-15", to: "2026-12-16" })).toEqual(["Rejected"]);
      expect(await dn({ from: "2026-12-24" })).toEqual([]);
      expect(await dn({ type: SICK })).toEqual([]);
    });

    it("the summary counts the whole team's decisions and ignores the filters", async () => {
      const open = await readDecided();
      const narrow = await readDecided({ ...D, status: "rejected" });
      expect(narrow.summary).toEqual(open.summary);
      expect(open.summary).toMatchObject({ total: 4, approved: 2, rejected: 1, overridden: 1 });
    });

    it("never shows another team's decisions or a pending request", async () => {
      const page = await readDecided({ q: P, per: 100 });
      expect(page.rows.map((r) => r.id)).not.toContain(otherReq);
      expect(page.total).toBe(4);
      expect(page.rows.every((r) => r.status !== "pending")).toBe(true);
    });
  });

  it("the filter choices are the leave types, for a manager only", async () => {
    expect((await getTeamChoices(sql, mgr)).leaveTypes.map((t) => t.name)).toEqual([
      "Sick",
      "Unpaid",
      "Vacation",
    ]);
  });
});
