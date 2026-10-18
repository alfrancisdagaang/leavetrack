import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { summarizeBalances } from "@/lib/leave/balance";
import { getTeamRoster } from "@/lib/leave/team-roster";

const MARCO = "00000000-0000-4000-8000-000000000002";
const ELENA = "00000000-0000-4000-8000-000000000003";
const JUN = "00000000-0000-4000-8000-000000000005";
const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const UNPAID = "10000000-0000-4000-8000-000000000003";
const TYPES = [
  { id: VAC, name: "Vacation", tracks_balance: true },
  { id: SICK, name: "Sick", tracks_balance: true },
  { id: UNPAID, name: "Unpaid", tracks_balance: false },
];

type Call = { text: string; values: unknown[] };

/** A fake postgres.js client: records each statement and answers with the given rows. */
function fakeSql(rows: unknown[]) {
  const calls: Call[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
    return Promise.resolve(rows);
  }) as unknown as Sql;
  return { sql, calls };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: ELENA,
  name: "Elena Cruz",
  role: "employee",
  out_today: false,
  next_start: null,
  pending_count: 0,
  last_request: null,
  types: TYPES,
  balances: [
    { leave_type_id: VAC, balance: "10.00" },
    { leave_type_id: SICK, balance: "5.00" },
  ],
  pending: [],
  ...over,
});

describe("getTeamRoster (US-12)", () => {
  it("AC1: the manager scope is part of the SQL and bound to the caller's id, in one statement", async () => {
    const { sql, calls } = fakeSql([]);
    await getTeamRoster(sql, MARCO, "2026-10-18");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toMatch(/where u\.manager_id = \? order by u\.name, u\.id$/);
    expect(calls[0]?.values.filter((v) => v === MARCO)).toHaveLength(1);
  });

  it("binds today (the app time zone's date) wherever it compares dates", async () => {
    const { sql, calls } = fakeSql([]);
    await getTeamRoster(sql, MARCO, "2026-10-18");
    // out today: start <= today and end >= today; next leave: start > today.
    expect(calls[0]?.values.filter((v) => v === "2026-10-18")).toHaveLength(3);
  });

  it("reads approved leave only for out-today and next leave, and pending only for the count", async () => {
    const { sql, calls } = fakeSql([]);
    await getTeamRoster(sql, MARCO, "2026-10-18");
    const text = calls[0]!.text;
    expect(text).toMatch(
      /r\.status = 'approved' and r\.is_deleted = false and r\.start_date <= \?::date/,
    );
    expect(text).toMatch(
      /r\.status = 'approved' and r\.is_deleted = false and r\.start_date > \?::date/,
    );
    expect(text).toMatch(
      /count\(\*\)::int from public\.leave_requests r where r\.user_id = u\.id and r\.status = 'pending'/,
    );
  });

  it("AC1: returns exactly the rows the database gives it, in that order (no filtering in TypeScript)", async () => {
    const { sql } = fakeSql([row({ id: JUN, name: "Jun Bautista" }), row()]);
    const roster = await getTeamRoster(sql, MARCO, "2026-10-18");
    expect(roster.map((m) => m.name)).toEqual(["Jun Bautista", "Elena Cruz"]);
  });

  it("AC3: a manager with no reports gets an empty list", async () => {
    const { sql } = fakeSql([]);
    expect(await getTeamRoster(sql, MARCO, "2026-10-18")).toEqual([]);
  });

  it("AC2: out today wins over next leave; next leave carries its start; otherwise none", async () => {
    const { sql } = fakeSql([
      row({ out_today: true, next_start: "2026-11-02" }),
      row({ id: JUN, name: "Jun", next_start: "2026-11-02" }),
      row({ id: "x", name: "Mia" }),
    ]);
    const roster = await getTeamRoster(sql, MARCO, "2026-10-18");
    expect(roster.map((m) => m.status)).toEqual([
      { kind: "out_today" },
      { kind: "next_leave", start: "2026-11-02" },
      { kind: "none" },
    ]);
  });

  it("AC2: carries the pending count and the last request's type and status", async () => {
    const { sql } = fakeSql([
      row({
        pending_count: 2,
        last_request: { leave_type_name: "Vacation", status: "approved" },
      }),
      row({ id: JUN, name: "Jun" }),
    ]);
    const [elena, jun] = await getTeamRoster(sql, MARCO, "2026-10-18");
    expect(elena?.pendingCount).toBe(2);
    expect(elena?.lastRequest).toEqual({ leaveTypeName: "Vacation", status: "approved" });
    expect(jun?.lastRequest).toBeNull();
  });

  it("AC2: days left are the same numbers My Balance shows (summarizeBalances), tracked types only", async () => {
    const pending = [{ leave_type_id: VAC, start_date: "2026-11-02", end_date: "2026-11-03" }];
    const balances = [
      { leave_type_id: VAC, balance: "10.00" },
      { leave_type_id: SICK, balance: "5.00" },
    ];
    const { sql } = fakeSql([row({ balances, pending })]);
    const [member] = await getTeamRoster(sql, MARCO, "2026-10-18");

    const expected = summarizeBalances(TYPES, balances, pending).filter((b) => b.tracksBalance);
    expect(member?.balances).toEqual(expected);
    expect(member?.balances.map((b) => b.leaveTypeName)).toEqual(["Vacation", "Sick"]);
    expect(member?.balances[0]).toMatchObject({ confirmed: 10, pending: 2, available: 8 });
  });

  it("a report with no balance rows shows 0 days, as My Balance does", async () => {
    const { sql } = fakeSql([row({ balances: [] })]);
    const [member] = await getTeamRoster(sql, MARCO, "2026-10-18");
    expect(member?.balances.map((b) => b.available)).toEqual([0, 0]);
  });
});
