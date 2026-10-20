import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import {
  getPolicyChoices,
  getPolicyPage,
  getRecentPolicyChanges,
  RECENT_CHANGES,
  setPolicyRate,
} from "@/lib/leave/policies";
import { DEFAULT_POLICY_QUERY, POLICY_PAGE_SIZE } from "@/lib/leave/policies-schema";

const HR = "00000000-0000-4000-8000-000000000001";
const EMP = "00000000-0000-4000-8000-000000000003";
const VAC = "10000000-0000-4000-8000-000000000001";

type Call = { text: string; values: unknown[] };

/** A fake client: records each statement with its values; `begin` runs the callback on a transaction fake. */
function fakeSql(answers: unknown[][]) {
  const calls: Call[] = [];
  let i = 0;
  const run = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return answers[i++] ?? [];
  };
  const sql = Object.assign(run, {
    begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(run),
  });
  return { sql: sql as unknown as Sql, calls };
}

const person = (name: string, rates: { n: string; r: string | null }[]) => ({
  id: name,
  name,
  managerName: null as string | null,
  lastChange: null as { at: string; by: string } | null,
  rates: rates.map((x) => ({ leaveTypeId: x.n, leaveTypeName: x.n, rate: x.r })),
});

const SUMMARY = { employees: 0, noPolicy: 0, changedThisMonth: 0 };
const EMPTY_PAGE = { total: 0, summary: SUMMARY, people: [] };
const ask = (over: Partial<Parameters<typeof getPolicyPage>[1]> = {}) => ({
  ...DEFAULT_POLICY_QUERY,
  viewerId: HR,
  timeZone: "UTC",
  ...over,
});

describe("getPolicyPage (TASK-071)", () => {
  it("is ONE statement, bound to the viewer, the literal search and the offset", async () => {
    const { sql, calls } = fakeSql([[EMPTY_PAGE]]);
    await getPolicyPage(sql, ask({ q: "100%_", page: 2 }));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values).toContain(HR);
    expect(calls[0]!.values).toContain("%100\\%\\_%");
    expect(calls[0]!.values).toContain((2 - 1) * POLICY_PAGE_SIZE);
  });

  it("checks the role in SQL, lists employees only and balance-tracked types only", async () => {
    const { sql, calls } = fakeSql([[EMPTY_PAGE]]);
    await getPolicyPage(sql, ask());
    const text = calls[0]!.text;
    expect(text).toContain("h.role = 'hr_admin'");
    expect(text).toContain("u.role = 'employee'");
    expect(text).toContain("lt.tracks_balance");
  });

  it("selects no email and no leave data", async () => {
    const { sql, calls } = fakeSql([[EMPTY_PAGE]]);
    await getPolicyPage(sql, ask());
    expect(calls[0]!.text).not.toMatch(/email|reason|leave_requests|leave_balances/);
  });

  it("binds the order, the page size and every filter as values, never as text", async () => {
    const { sql, calls } = fakeSql([[EMPTY_PAGE]]);
    const team = "00000000-0000-4000-8000-000000000002";
    const type = "10000000-0000-4000-8000-000000000001";
    await getPolicyPage(
      sql,
      ask({
        sort: "vacation",
        dir: "desc",
        per: 50,
        team,
        type,
        status: "none",
        timeZone: "Asia/Manila",
      }),
    );
    const values = calls[0]!.values;
    for (const v of ["vacation", "desc", 50, team, type, "none", "Asia/Manila"])
      expect(values, String(v)).toContain(v);
    const text = calls[0]!.text;
    expect(text).not.toContain(team);
    expect(text).not.toContain("Asia/Manila");
    // the order is a CASE over bound values; there is no text-built column in it
    expect(text).toMatch(/order by\s+case when \?\s*=\s*'vacation'/);
    expect(text).toContain("nulls last");
  });

  it("breaks ties by name then id, so paging is stable", async () => {
    const { sql, calls } = fakeSql([[EMPTY_PAGE]]);
    await getPolicyPage(sql, ask());
    expect(calls[0]!.text).toMatch(/f\.name, f\.id\) as rn/);
    expect(calls[0]!.text).toContain("order by o.rn");
    expect(calls[0]!.text).toContain("order by k.rn");
  });

  it("clamps the page in SQL and counts the total before the cut", async () => {
    const { sql, calls } = fakeSql([[{ ...EMPTY_PAGE, total: 30 }]]);
    const page = await getPolicyPage(sql, ask({ page: 99 }));
    expect(calls[0]!.text).toContain("least(");
    expect(calls[0]!.text.indexOf("counts as")).toBeLessThan(calls[0]!.text.indexOf("kept as"));
    expect(page).toMatchObject({ total: 30, page: 2, pageSize: POLICY_PAGE_SIZE });
  });

  it("the page size is the chosen one", async () => {
    const { sql } = fakeSql([[{ ...EMPTY_PAGE, total: 130 }]]);
    expect(await getPolicyPage(sql, ask({ per: 100, page: 99 }))).toMatchObject({
      page: 2,
      pageSize: 100,
    });
  });

  it("the summary is computed for the whole company: no filter value is used in it", async () => {
    const { sql, calls } = fakeSql([[EMPTY_PAGE]]);
    await getPolicyPage(sql, ask({ q: "x", team: "t", status: "has" }));
    const text = calls[0]!.text;
    const summary = text.slice(text.indexOf("summary as ("), text.indexOf("ordered as ("));
    expect(summary).toContain("u.role = 'employee'");
    expect(summary).not.toMatch(/b\.|f\./);
  });

  it("orders each person's rates Vacation, Sick, then any other type by name, and maps the last change", async () => {
    const { sql } = fakeSql([
      [
        {
          total: 1,
          summary: { employees: 9, noPolicy: 2, changedThisMonth: 3 },
          people: [
            {
              ...person("A", [
                { n: "Zeta", r: null },
                { n: "Sick", r: "1.00" },
                { n: "Vacation", r: "1.25" },
              ]),
              managerName: "Marco",
              lastChange: { at: "2026-10-20T01:41:00+00:00", by: "Hana" },
            },
          ],
        },
      ],
    ]);
    const page = await getPolicyPage(sql, ask());
    expect(page.people[0]!.rates.map((r) => r.leaveTypeName)).toEqual(["Vacation", "Sick", "Zeta"]);
    expect(page.people[0]!.lastChange).toEqual({ at: "2026-10-20T01:41:00.000Z", by: "Hana" });
    expect(page.summary).toEqual({ employees: 9, noPolicy: 2, changedThisMonth: 3 });
  });

  it("throws if the statement returns no row", async () => {
    await expect(getPolicyPage(fakeSql([[]]).sql, ask())).rejects.toThrow();
  });
});

describe("getPolicyChoices", () => {
  it("is ONE statement, HR only in SQL, bound to the viewer, managers with employees and tracked types", async () => {
    const { sql, calls } = fakeSql([[{ managers: [{ id: "m", name: "Marco" }], leaveTypes: [] }]]);
    expect(await getPolicyChoices(sql, HR)).toEqual({
      managers: [{ id: "m", name: "Marco" }],
      leaveTypes: [],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values).toEqual([HR, HR]);
    expect(calls[0]!.text).toContain("h.role = 'hr_admin'");
    expect(calls[0]!.text).toContain("e.role = 'employee'");
    expect(calls[0]!.text).toContain("lt.tracks_balance");
  });

  it("throws if the statement returns no row", async () => {
    await expect(getPolicyChoices(fakeSql([[]]).sql, HR)).rejects.toThrow();
  });
});

describe("getRecentPolicyChanges", () => {
  it("is ONE statement, HR only in SQL, newest first, at most 10", async () => {
    const { sql, calls } = fakeSql([[]]);
    expect(await getRecentPolicyChanges(sql, HR)).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values).toEqual([HR, RECENT_CHANGES]);
    expect(calls[0]!.text).toContain("h.role = 'hr_admin'");
    expect(calls[0]!.text).toContain("order by c.changed_at desc");
  });

  it("maps a row to names, rates and an ISO time, with no ids of other people leaking", async () => {
    const at = new Date("2026-10-20T01:02:03Z");
    const { sql } = fakeSql([
      [
        {
          id: "c1",
          employee_name: "Elena",
          leave_type_name: "Vacation",
          changed_by_name: "Hana",
          old_rate: null,
          new_rate: "1.50",
          changed_at: at,
        },
      ],
    ]);
    expect(await getRecentPolicyChanges(sql, HR)).toEqual([
      {
        id: "c1",
        employeeName: "Elena",
        leaveTypeName: "Vacation",
        changedByName: "Hana",
        oldRate: null,
        newRate: "1.50",
        changedAt: "2026-10-20T01:02:03.000Z",
      },
    ]);
  });
});

const checks = (over: Partial<Record<string, unknown>> = {}) => [
  {
    actor_ok: true,
    actor_name: "Hana",
    employee_ok: true,
    type_ok: true,
    old_rate: "1.25",
    ...over,
  },
];
const WRITTEN = [{ changed_at: new Date("2026-10-20T01:41:00Z") }];
const input = { actorId: HR, userId: EMP, leaveTypeId: VAC, rate: "1.50" };

describe("setPolicyRate (TASK-071)", () => {
  it("locks, checks and writes in one transaction: three statements, the actor from the input only", async () => {
    const { sql, calls } = fakeSql([[], checks(), WRITTEN]);
    const r = await setPolicyRate(sql, input);
    expect(r).toEqual({
      status: "changed",
      oldRate: "1.25",
      newRate: "1.50",
      changedAt: "2026-10-20T01:41:00.000Z",
      changedByName: "Hana",
    });
    expect(calls).toHaveLength(3);
    expect(calls[0]!.text).toContain("pg_advisory_xact_lock");
    expect(calls[1]!.text).toContain("a.role = 'hr_admin'");
    expect(calls[1]!.text).toContain("u.role = 'employee'");
    expect(calls[1]!.text).toContain("lt.tracks_balance");
    // the rate and its change row are ONE statement
    expect(calls[2]!.text).toContain("insert into public.leave_policies");
    expect(calls[2]!.text).toContain("insert into public.leave_policy_changes");
    expect(calls[2]!.values).toEqual(expect.arrayContaining([HR, EMP, VAC, "1.50", "1.25"]));
  });

  it("records a null old rate when there was no policy", async () => {
    const { sql, calls } = fakeSql([[], checks({ old_rate: null }), WRITTEN]);
    expect(await setPolicyRate(sql, input)).toMatchObject({ status: "changed", oldRate: null });
    expect(calls[2]!.values).toContain(null);
  });

  it("an unchanged rate writes nothing: two statements, no write", async () => {
    const { sql, calls } = fakeSql([[], checks({ old_rate: "1.50" }), []]);
    expect(await setPolicyRate(sql, input)).toEqual({
      status: "unchanged",
      oldRate: "1.50",
      newRate: "1.50",
      changedAt: null,
      changedByName: null,
    });
    expect(calls).toHaveLength(2);
  });

  it("a non-HR actor is FORBIDDEN and nothing is written", async () => {
    const { sql, calls } = fakeSql([[], checks({ actor_ok: false })]);
    const err = await setPolicyRate(sql, input).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("FORBIDDEN");
    expect(calls).toHaveLength(2);
  });

  it.each([{ employee_ok: false }, { type_ok: false }])(
    "%j is one generic NOT_FOUND and nothing is written",
    async (over) => {
      const { sql, calls } = fakeSql([[], checks(over)]);
      const err = await setPolicyRate(sql, input).catch((e: unknown) => e);
      expect((err as AppError).code).toBe("NOT_FOUND");
      expect(calls).toHaveLength(2);
    },
  );

  it("no checks row at all is refused, not allowed", async () => {
    const { sql } = fakeSql([[], []]);
    await expect(setPolicyRate(sql, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
