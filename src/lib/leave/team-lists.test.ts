import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { getTeamChoices, getTeamDecidedPage, getTeamQueuePage } from "@/lib/leave/team-lists";
import { DEFAULT_TEAM_QUERY } from "@/lib/leave/team-queue-schema";

const MARCO = "00000000-0000-4000-8000-000000000002";
const TYPE = "10000000-0000-4000-8000-000000000001";

function fakeSql(row: unknown) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return row === undefined ? [] : [row];
  }) as unknown as Sql;
  return { sql, calls };
}

const PENDING_SUMMARY = { pending: 0, canApprove: 0, cannotApprove: 0, oldestDays: null };
const emptyPending = { total: 0, summary: PENDING_SUMMARY, rows: [] };
const emptyDecided = {
  total: 0,
  summary: { total: 0, approved: 0, rejected: 0, overridden: 0 },
  rows: [],
};
const ask = (over: Partial<typeof DEFAULT_TEAM_QUERY> = {}) => ({
  ...DEFAULT_TEAM_QUERY,
  managerId: MARCO,
  ...over,
});

const rawRow = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  employee_name: "Elena Cruz",
  leave_type_id: TYPE,
  leave_type_name: "Vacation",
  tracks_balance: true,
  start_date: "2026-11-02",
  end_date: "2026-11-04",
  reason: "Trip",
  status: "pending",
  created_at: "2026-10-14T00:00:00+00:00",
  balance: "2.00",
  working_days: 3,
  ...over,
});

describe("getTeamQueuePage (EPIC-14)", () => {
  it("is ONE statement, scoped to the session manager in the SQL, who must really be a manager", async () => {
    const { sql, calls } = fakeSql(emptyPending);
    await getTeamQueuePage(sql, ask());
    expect(calls).toHaveLength(1);
    const { text, values } = calls[0]!;
    expect(values).toContain(MARCO);
    expect(text).toContain("u.manager_id = ?::uuid");
    expect(text).toContain("m.role = 'manager'");
    expect(text).toContain("r.status = 'pending' and r.is_deleted = false");
  });

  it("binds the filters, the order and the page size as values, never as text", async () => {
    const { sql, calls } = fakeSql(emptyPending);
    await getTeamQueuePage(
      sql,
      ask({
        q: "100%_",
        type: TYPE,
        status: "over",
        from: "2026-11-01",
        to: "2026-11-30",
        sort: "days",
        dir: "desc",
        per: 50,
        page: 2,
      }),
    );
    const { text, values } = calls[0]!;
    for (const v of [
      "%100\\%\\_%",
      TYPE,
      "over",
      "2026-11-01",
      "2026-11-30",
      "days",
      "desc",
      50,
      50,
    ])
      expect(values, String(v)).toContain(v);
    expect(text).not.toContain(TYPE);
    expect(text).not.toContain("2026-11-01");
    expect(text).toMatch(
      /order by\s+case when \? = 'created' and \? = 'asc' then f\.created_at end asc/,
    );
  });

  it("breaks ties by submission time then id, and carries the order as a row number through the page", async () => {
    const { sql, calls } = fakeSql(emptyPending);
    await getTeamQueuePage(sql, ask());
    expect(calls[0]!.text).toMatch(/f\.created_at, f\.id\) as rn/);
    expect(calls[0]!.text).toContain("order by o.rn");
    expect(calls[0]!.text).toContain("order by k.rn");
  });

  it("counts working days in SQL and derives the three balance states like checkOverBalance", async () => {
    const { sql, calls } = fakeSql(emptyPending);
    await getTeamQueuePage(sql, ask());
    const text = calls[0]!.text;
    expect(text).toContain("extract(isodow from g) < 6");
    expect(text).toContain("when not lt.tracks_balance then 'ok'");
    expect(text).toContain("when lb.balance is null then 'blocked'");
    expect(text).toContain("when lb.balance < 0 then 'blocked'");
    expect(text).toContain("when d.days > lb.balance then 'over'");
  });

  it("computes the summary from the whole team: no filter is used in it", async () => {
    const { sql, calls } = fakeSql(emptyPending);
    await getTeamQueuePage(sql, ask({ q: "x", status: "ok" }));
    const text = calls[0]!.text;
    const summary = text.slice(text.indexOf("summary as ("), text.indexOf("ordered as ("));
    expect(summary).toContain("from base");
    expect(summary).not.toMatch(/\bf\.|from f\b/);
  });

  it("clamps the page in SQL and reports the page that was shown", async () => {
    const { sql, calls } = fakeSql({ ...emptyPending, total: 30 });
    const page = await getTeamQueuePage(sql, ask({ page: 99 }));
    expect(calls[0]!.text).toContain("least(");
    expect(calls[0]!.text.indexOf("counts as")).toBeLessThan(calls[0]!.text.indexOf("kept as"));
    expect(page).toMatchObject({ total: 30, page: 2, pageSize: 25 });
  });

  it("maps a row: a Date, a numeric balance and the over-balance check from the TypeScript rule", async () => {
    const { sql } = fakeSql({ ...emptyPending, total: 1, rows: [rawRow()] });
    const page = await getTeamQueuePage(sql, ask());
    const r = page.rows[0]!;
    expect(r.created_at).toEqual(new Date("2026-10-14T00:00:00Z"));
    expect(r.balance).toBe(2);
    expect(r.balanceCheck).toEqual({ kind: "over", balance: 2, shortfall: 1 });
    expect(r.working_days).toBe(3);
  });

  it("an untracked type has no balance and is ok; a missing row is a missing record", async () => {
    const { sql } = fakeSql({
      ...emptyPending,
      total: 2,
      rows: [
        rawRow({ id: "u", tracks_balance: false, balance: "0.00" }),
        rawRow({ id: "n", balance: null }),
      ],
    });
    const rows = (await getTeamQueuePage(sql, ask())).rows;
    expect(rows[0]).toMatchObject({ balance: null, balanceCheck: { kind: "ok" } });
    expect(rows[1]).toMatchObject({ balance: null, balanceCheck: { kind: "no_balance_record" } });
  });

  it("throws if the statement returns no row", async () => {
    await expect(getTeamQueuePage(fakeSql(undefined).sql, ask())).rejects.toThrow();
  });
});

describe("getTeamDecidedPage (EPIC-14)", () => {
  it("is ONE statement scoped to the manager's team, decided and not deleted requests only", async () => {
    const { sql, calls } = fakeSql(emptyDecided);
    await getTeamDecidedPage(sql, ask({ view: "decided", sort: "decided", dir: "desc" }));
    expect(calls).toHaveLength(1);
    const text = calls[0]!.text;
    expect(calls[0]!.values).toContain(MARCO);
    expect(text).toContain("u.manager_id = ?::uuid");
    expect(text).toContain("m.role = 'manager'");
    expect(text).toContain("r.status <> 'pending' and r.is_deleted = false");
  });

  it("separates an approval by the manager from an HR override, and binds the status", async () => {
    const { sql, calls } = fakeSql(emptyDecided);
    await getTeamDecidedPage(
      sql,
      ask({ view: "decided", status: "overridden", sort: "decided", dir: "desc" }),
    );
    const text = calls[0]!.text;
    expect(calls[0]!.values).toContain("overridden");
    expect(text).toContain("b.status = 'approved' and not b.overridden");
    expect(text).toContain("a.action = 'override_approved'");
  });

  it("maps decided_at to a Date and keeps the note", async () => {
    const { sql } = fakeSql({
      ...emptyDecided,
      total: 1,
      rows: [
        {
          id: "d1",
          employee_name: "Elena Cruz",
          leave_type_name: "Vacation",
          start_date: "2026-12-01",
          end_date: "2026-12-02",
          status: "rejected",
          decision_note: "Not this week",
          decided_at: "2026-10-02T10:00:00+00:00",
          working_days: 2,
          overridden: false,
        },
      ],
    });
    const r = (await getTeamDecidedPage(sql, ask({ view: "decided" }))).rows[0]!;
    expect(r.decided_at).toEqual(new Date("2026-10-02T10:00:00Z"));
    expect(r.decision_note).toBe("Not this week");
  });

  it("the summary ignores the filters", async () => {
    const { sql, calls } = fakeSql(emptyDecided);
    await getTeamDecidedPage(sql, ask({ view: "decided", q: "x", status: "rejected" }));
    const text = calls[0]!.text;
    const summary = text.slice(text.indexOf("summary as ("), text.indexOf("ordered as ("));
    expect(summary).toContain("from base");
    expect(summary).not.toMatch(/\bf\.|from f\b/);
  });
});

describe("getTeamChoices", () => {
  it("is ONE statement bound to the manager, only for a real manager", async () => {
    const { sql, calls } = fakeSql({ leaveTypes: [{ id: TYPE, name: "Vacation" }] });
    expect(await getTeamChoices(sql, MARCO)).toEqual({
      leaveTypes: [{ id: TYPE, name: "Vacation" }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values).toEqual([MARCO]);
    expect(calls[0]!.text).toContain("m.role = 'manager'");
  });
  it("throws if the statement returns no row", async () => {
    await expect(getTeamChoices(fakeSql(undefined).sql, MARCO)).rejects.toThrow();
  });
});
