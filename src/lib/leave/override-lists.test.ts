import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import {
  getOverrideChoices,
  getOverriddenPage,
  getOverrideQueuePage,
} from "@/lib/leave/override-lists";
import { DEFAULT_OVERRIDE_QUERY } from "@/lib/leave/override-list-schema";

const HR = "00000000-0000-4000-8000-000000000001";
const TEAM = "00000000-0000-4000-8000-000000000002";
const TYPE = "10000000-0000-4000-8000-000000000001";

function fakeSql(row: unknown) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return row === undefined ? [] : [row];
  }) as unknown as Sql;
  return { sql, calls };
}

const emptyWaiting = {
  total: 0,
  summary: { waiting: 0, biggestShortfall: null, oldestDays: null },
  rows: [],
};
const emptyDone = { total: 0, summary: { total: 0, totalShortfall: "0", thisMonth: 0 }, rows: [] };
const wq = (over: Partial<typeof DEFAULT_OVERRIDE_QUERY> = {}) => ({
  ...DEFAULT_OVERRIDE_QUERY,
  hrId: HR,
  ...over,
});

describe("getOverrideQueuePage (EPIC-14)", () => {
  it("is ONE statement; the viewer must be an hr_admin in the SQL, and HR's own request is excluded", async () => {
    const { sql, calls } = fakeSql(emptyWaiting);
    await getOverrideQueuePage(sql, wq());
    expect(calls).toHaveLength(1);
    const { text, values } = calls[0]!;
    expect(values).toContain(HR);
    expect(text).toContain("h.role = 'hr_admin'");
    expect(text).toContain("r.user_id <> ?::uuid");
  });

  it("keeps exactly the conditions of the old queue, the count and the override route", async () => {
    const { sql, calls } = fakeSql(emptyWaiting);
    await getOverrideQueuePage(sql, wq());
    const text = calls[0]!.text;
    expect(text).toContain("r.status = 'pending' and r.is_deleted = false");
    expect(text).toContain("lt.tracks_balance");
    expect(text).toContain("join public.leave_balances lb");
    expect(text).toContain("lb.balance >= 0 and lb.balance < d.days");
    expect(text).toContain("extract(isodow from g) < 6");
  });

  it("binds the filters, the order and the page size, and has no cap of 50", async () => {
    const { sql, calls } = fakeSql(emptyWaiting);
    await getOverrideQueuePage(
      sql,
      wq({
        q: "ana",
        type: TYPE,
        team: TEAM,
        from: "2026-11-01",
        to: "2026-11-30",
        sort: "shortfall",
        dir: "desc",
        per: 100,
        page: 3,
      }),
    );
    const { text, values } = calls[0]!;
    for (const v of [
      "%ana%",
      TYPE,
      TEAM,
      "2026-11-01",
      "2026-11-30",
      "shortfall",
      "desc",
      100,
      200,
    ])
      expect(values, String(v)).toContain(v);
    expect(text).not.toContain("limit 50");
    expect(text).toContain("b.manager_id = ?::uuid");
  });

  it("orders from the whitelist with the biggest shortfall option and a stable tie-break", async () => {
    const { sql, calls } = fakeSql(emptyWaiting);
    await getOverrideQueuePage(sql, wq());
    expect(calls[0]!.text).toContain("then f.shortfall end desc");
    expect(calls[0]!.text).toMatch(/f\.created_at, f\.id\) as rn/);
  });

  it("the summary is company-wide: it does not use the filtered rows", async () => {
    const { sql, calls } = fakeSql(emptyWaiting);
    await getOverrideQueuePage(sql, wq({ q: "x", team: TEAM }));
    const text = calls[0]!.text;
    const summary = text.slice(text.indexOf("summary as ("), text.indexOf("ordered as ("));
    expect(summary).toContain("from base");
    expect(summary).not.toMatch(/\bf\.|from f\b/);
  });

  it("maps created_at to a Date and reports the clamped page", async () => {
    const { sql } = fakeSql({
      total: 30,
      summary: { waiting: 30, biggestShortfall: "3.00", oldestDays: 4 },
      rows: [
        {
          id: "r1",
          employee_name: "Elena Cruz",
          manager_name: null,
          leave_type_name: "Vacation",
          start_date: "2026-11-02",
          end_date: "2026-11-04",
          reason: "",
          created_at: "2026-10-14T00:00:00+00:00",
          working_days: 3,
          balance: "0.00",
          shortfall: "3.00",
        },
      ],
    });
    const page = await getOverrideQueuePage(sql, wq({ page: 99 }));
    expect(page).toMatchObject({ total: 30, page: 2, pageSize: 25 });
    expect(page.rows[0]!.created_at).toEqual(new Date("2026-10-14T00:00:00Z"));
    expect(page.summary.biggestShortfall).toBe("3.00");
  });

  it("throws if the statement returns no row", async () => {
    await expect(getOverrideQueuePage(fakeSql(undefined).sql, wq())).rejects.toThrow();
  });
});

describe("getOverriddenPage (EPIC-14)", () => {
  const dq = (over = {}) => ({
    ...wq({ view: "overridden", sort: "approved", dir: "desc", ...over }),
    timeZone: "Asia/Manila",
  });

  it("is ONE statement over override_approved audit rows for an hr_admin, with no reason or note", async () => {
    const { sql, calls } = fakeSql(emptyDone);
    await getOverriddenPage(sql, dq());
    expect(calls).toHaveLength(1);
    const text = calls[0]!.text;
    expect(text).toContain("a.action = 'override_approved'");
    expect(text).toContain("h.role = 'hr_admin'");
    expect(text).not.toMatch(/r\.reason|decision_note/);
    expect(calls[0]!.values).toContain("Asia/Manila");
  });

  it("binds filters and order, and the summary ignores them", async () => {
    const { sql, calls } = fakeSql(emptyDone);
    await getOverriddenPage(sql, dq({ q: "x", team: TEAM, type: TYPE, sort: "shortfall" }));
    const { text, values } = calls[0]!;
    for (const v of ["%x%", TEAM, TYPE, "shortfall"]) expect(values, v).toContain(v);
    const summary = text.slice(text.indexOf("summary as ("), text.indexOf("ordered as ("));
    expect(summary).toContain("from base b, month m");
    expect(summary).not.toMatch(/\bf\.|from f\b/);
  });

  it("maps occurred_at to a Date", async () => {
    const { sql } = fakeSql({
      total: 1,
      summary: { total: 1, totalShortfall: "3.00", thisMonth: 1 },
      rows: [
        {
          id: "a1",
          employee_name: "Elena Cruz",
          leave_type_name: "Vacation",
          start_date: "2026-12-01",
          end_date: "2026-12-03",
          approved_by_name: "Hana Reyes",
          occurred_at: "2026-10-01T10:00:00+00:00",
          days_requested: "3.00",
          shortfall: "3.00",
        },
      ],
    });
    const r = (await getOverriddenPage(sql, dq())).rows[0]!;
    expect(r.occurred_at).toEqual(new Date("2026-10-01T10:00:00Z"));
  });
});

describe("getOverrideChoices", () => {
  it("is ONE statement bound to the HR viewer, the tracked leave types and managers with employees", async () => {
    const { sql, calls } = fakeSql({ leaveTypes: [], managers: [] });
    await getOverrideChoices(sql, HR);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values).toEqual([HR, HR]);
    expect(calls[0]!.text).toContain("lt.tracks_balance");
    expect(calls[0]!.text).toContain("h.role = 'hr_admin'");
    expect(calls[0]!.text).toContain("e.role = 'employee'");
  });
  it("throws if the statement returns no row", async () => {
    await expect(getOverrideChoices(fakeSql(undefined).sql, HR)).rejects.toThrow();
  });
});
