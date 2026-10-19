import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { MEMBER_PAGE_SIZE, type TeamMemberQuery } from "@/lib/leave/schemas";
import { getTeamMemberPage } from "@/lib/leave/team-member";

const MARCO = "00000000-0000-4000-8000-000000000002";
const ELENA = "00000000-0000-4000-8000-000000000003";
const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const UNPAID = "10000000-0000-4000-8000-000000000003";
const TYPES = [
  { id: VAC, name: "Vacation", tracks_balance: true },
  { id: SICK, name: "Sick", tracks_balance: true },
  { id: UNPAID, name: "Unpaid", tracks_balance: false },
];
const QUERY: TeamMemberQuery = { leaveTypeId: undefined, status: undefined, year: 2026, page: 1 };

type Call = { text: string; values: unknown[] };

function fakeSql(rows: unknown[]) {
  const calls: Call[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
    return Promise.resolve(rows);
  }) as unknown as Sql;
  return { sql, calls };
}

const request = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  leave_type_id: VAC,
  leave_type_name: "Vacation",
  tracks_balance: true,
  start_date: "2026-03-02",
  end_date: "2026-03-04",
  status: "approved",
  decision_note: null,
  reason: null,
  overridden: false,
  ...over,
});
const row = (over: Record<string, unknown> = {}) => ({
  member: { id: ELENA, name: "Elena Cruz", role: "employee" },
  types: TYPES,
  balances: [
    { leave_type_id: VAC, balance: "10.00" },
    { leave_type_id: SICK, balance: "5.00" },
  ],
  pending: [],
  total: 1,
  requests: [request()],
  ...over,
});

describe("getTeamMemberPage: the scope (US-13 AC7, BR-02)", () => {
  it("runs one statement, and the member is found only through the manager's id, in the SQL", async () => {
    const { sql, calls } = fakeSql([row()]);
    await getTeamMemberPage(sql, MARCO, ELENA, QUERY);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toMatch(
      /with member as \( select u\.id, u\.name, u\.role from public\.users u where u\.id = \? and u\.manager_id = \? \)/,
    );
    expect(calls[0]?.values.slice(0, 2)).toEqual([ELENA, MARCO]);
  });

  it("reads requests, balances and pending ranges only through the member CTE", async () => {
    const { sql, calls } = fakeSql([row()]);
    await getTeamMemberPage(sql, MARCO, ELENA, QUERY);
    const text = calls[0]!.text;
    expect(text).toContain("join member m on m.id = r.user_id");
    expect(text).toContain("from public.leave_balances b join member m on m.id = b.user_id");
    expect(text).toMatch(
      /from public\.leave_requests r join member m on m\.id = r\.user_id where r\.status = 'pending'/,
    );
    // The manager id appears once: no other part can reach users or requests on its own.
    expect(calls[0]?.values.filter((v) => v === MARCO)).toHaveLength(1);
  });

  it("returns null when the database finds no such report, whatever the reason", async () => {
    const { sql } = fakeSql([row({ member: null })]);
    expect(await getTeamMemberPage(sql, MARCO, ELENA, QUERY)).toBeNull();
    expect(await getTeamMemberPage(fakeSql([]).sql, MARCO, ELENA, QUERY)).toBeNull();
  });
});

describe("getTeamMemberPage: privacy of the reason (US-13 AC4)", () => {
  it("selects the employee's reason only for a pending request, inside the SQL", async () => {
    const { sql, calls } = fakeSql([row()]);
    await getTeamMemberPage(sql, MARCO, ELENA, QUERY);
    expect(calls[0]?.text).toContain("case when r.status = 'pending' then r.reason end as reason");
    // The raw column is not selected anywhere else.
    expect(calls[0]?.text.match(/r\.reason/g)).toHaveLength(1);
  });

  it("passes the reason through only as the database returned it (null for a decided request)", async () => {
    const { sql } = fakeSql([
      row({
        requests: [
          request({ id: "p", status: "pending", reason: "Family trip" }),
          request({ id: "d", status: "approved", reason: null }),
        ],
      }),
    ]);
    const page = await getTeamMemberPage(sql, MARCO, ELENA, QUERY);
    expect(page?.requests.map((r) => r.reason)).toEqual(["Family trip", null]);
  });
});

describe("getTeamMemberPage: filters and paging (US-13 AC2, AC6)", () => {
  it("binds the leave type, status and year range, and nulls for 'all'", async () => {
    const all = fakeSql([row()]);
    await getTeamMemberPage(all.sql, MARCO, ELENA, QUERY);
    expect(all.calls[0]?.values).toEqual(
      expect.arrayContaining([null, "2026-12-31", "2026-01-01"]),
    );

    const filtered = fakeSql([row()]);
    await getTeamMemberPage(filtered.sql, MARCO, ELENA, {
      leaveTypeId: SICK,
      status: "pending",
      year: 2025,
      page: 1,
    });
    expect(filtered.calls[0]?.values).toEqual(
      expect.arrayContaining([SICK, "pending", "2025-12-31", "2025-01-01"]),
    );
    expect(filtered.calls[0]?.text).toContain("r.start_date <= ?::date and r.end_date >= ?::date");
  });

  it("pages 25 at a time, newest start date first, with the total from the same statement", async () => {
    const { sql, calls } = fakeSql([row({ total: 31 })]);
    const page = await getTeamMemberPage(sql, MARCO, ELENA, { ...QUERY, page: 2 });

    expect(calls[0]?.text).toContain(
      "order by start_date desc, id desc limit ?::int offset ?::int",
    );
    expect(calls[0]?.values.slice(-2)).toEqual([MEMBER_PAGE_SIZE, MEMBER_PAGE_SIZE]);
    expect(page?.total).toBe(31);
  });

  it("works out working days per request", async () => {
    const { sql } = fakeSql([row()]);
    const page = await getTeamMemberPage(sql, MARCO, ELENA, QUERY);
    expect(page?.requests[0]?.workingDays).toBe(3);
  });
});

describe("getTeamMemberPage: balances and the approval rule (US-13 AC1, AC5)", () => {
  it("returns the tracked types' balances from the same function My Balance uses", async () => {
    const pending = [{ leave_type_id: VAC, start_date: "2026-11-02", end_date: "2026-11-03" }];
    const { sql } = fakeSql([row({ pending })]);
    const page = await getTeamMemberPage(sql, MARCO, ELENA, QUERY);
    expect(
      page?.balances.map((b) => [b.leaveTypeName, b.confirmed, b.pending, b.available]),
    ).toEqual([
      ["Vacation", 10, 2, 8],
      ["Sick", 5, 0, 5],
    ]);
    expect(page?.leaveTypes.map((t) => t.name)).toEqual(["Vacation", "Sick", "Unpaid"]);
  });

  it("carries whether HR approved a request as an override, and asks for it in the same statement", async () => {
    const { sql, calls } = fakeSql([
      row({ requests: [request({ id: "o", overridden: true }), request({ id: "n" })] }),
    ]);
    const page = await getTeamMemberPage(sql, MARCO, ELENA, QUERY);
    expect(page?.requests.map((r) => r.overridden)).toEqual([true, false]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).toContain("a.action = 'override_approved'");
  });

  it("a negative balance is its own state, not 'over' (HR cannot override it)", async () => {
    const { sql } = fakeSql([
      row({
        balances: [{ leave_type_id: VAC, balance: "-2.00" }],
        requests: [request({ id: "a", status: "pending" })],
      }),
    ]);
    const page = await getTeamMemberPage(sql, MARCO, ELENA, QUERY);
    expect(page?.requests[0]?.balanceCheck).toEqual({ kind: "negative", balance: -2 });
  });

  it("flags a pending request the balance cannot cover, as the approvals queue does", async () => {
    const { sql } = fakeSql([
      row({
        balances: [{ leave_type_id: VAC, balance: "2.00" }],
        requests: [
          request({ id: "a", status: "pending", start_date: "2026-11-02", end_date: "2026-11-06" }),
        ],
      }),
    ]);
    const page = await getTeamMemberPage(sql, MARCO, ELENA, QUERY);
    // Nov 2 to Nov 6 is 5 working days against 2 confirmed: over by exactly 3.
    expect(page?.requests[0]?.balanceCheck).toEqual({ kind: "over", balance: 2, shortfall: 3 });
  });

  it("flags a tracked type with no balance row, never Unpaid, and never a decided request", async () => {
    const { sql } = fakeSql([
      row({
        balances: [],
        requests: [
          request({ id: "a", status: "pending" }),
          request({
            id: "b",
            status: "pending",
            leave_type_id: UNPAID,
            leave_type_name: "Unpaid",
            tracks_balance: false,
          }),
          request({ id: "c", status: "approved" }),
        ],
      }),
    ]);
    const page = await getTeamMemberPage(sql, MARCO, ELENA, QUERY);
    expect(page?.requests.map((r) => r.balanceCheck.kind)).toEqual([
      "no_balance_record",
      "ok",
      "ok",
    ]);
  });

  it("carries the manager's rejection note", async () => {
    const { sql } = fakeSql([
      row({ requests: [request({ status: "rejected", decision_note: "Not this week" })] }),
    ]);
    const page = await getTeamMemberPage(sql, MARCO, ELENA, QUERY);
    expect(page?.requests[0]).toMatchObject({ status: "rejected", decisionNote: "Not this week" });
  });
});
