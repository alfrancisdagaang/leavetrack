import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { getAuditFilterChoices, getAuditPage, likePattern } from "@/lib/leave/audit-list";
import type { AuditListQuery } from "@/lib/leave/schemas";

const NONE: AuditListQuery = {
  q: undefined,
  leaveTypeId: undefined,
  status: undefined,
  decidedBy: undefined,
  from: undefined,
  to: undefined,
  page: 1,
};

type Call = { text: string; values: unknown[] };

function fakeSql(rows: unknown[]) {
  const calls: Call[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
    return Promise.resolve(rows);
  }) as unknown as Sql;
  return { sql, calls };
}

const raw = (over: Record<string, unknown> = {}) => ({
  total: 1,
  approved: 1,
  rejected: 0,
  pending: 0,
  deleted: 0,
  rows: [
    {
      id: "r1",
      employeeId: "e1",
      employeeName: "Elena Cruz",
      employeeRole: "employee",
      leaveTypeName: "Vacation",
      startDate: "2026-11-02",
      endDate: "2026-11-04",
      status: "approved",
      isDeleted: false,
      decidedByName: "Marco Santos",
      decidedByRole: "manager",
      decidedAt: "2026-10-18T09:12:00+00:00",
      createdAt: "2026-10-17T08:00:00+00:00",
    },
  ],
  ...over,
});

describe("getAuditPage (US-14)", () => {
  it("reads everything in ONE statement: the counts and the page of rows", async () => {
    const { sql, calls } = fakeSql([raw()]);
    await getAuditPage(sql, NONE);
    expect(calls).toHaveLength(1);
  });

  it("TASK-040: flags an override approval per page row from the audit log, in the same statement", async () => {
    const { sql, calls } = fakeSql([
      raw({
        rows: [
          { ...raw().rows[0], overridden: true },
          { ...raw().rows[0], id: "r2" },
        ],
      }),
    ]);
    const page = await getAuditPage(sql, NONE);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).toContain("a.action = 'override_approved'");
    expect(calls[0]!.text).toContain("as overridden");
    expect(page.rows[0]?.overridden).toBe(true);
    // The counts are still computed from the request status alone, so the buckets cannot change.
    expect(calls[0]!.text).toContain(
      "case when r.is_deleted then 'deleted' else r.status::text end as bucket",
    );
  });

  it("only reads: it issues a select and never writes", async () => {
    const { sql, calls } = fakeSql([raw()]);
    await getAuditPage(sql, NONE);
    const text = calls[0]!.text;
    expect(text).toMatch(/^with f as/);
    expect(text).not.toMatch(/\b(insert|update|delete|truncate|drop|alter)\b/i);
  });

  it("never selects the employee's free-text reason or the decision note", async () => {
    const { sql, calls } = fakeSql([raw()]);
    await getAuditPage(sql, NONE);
    expect(calls[0]!.text).not.toMatch(/\breason\b|decision_note/);
  });

  it("puts every filter value in the query as a parameter, never in the SQL text", async () => {
    const { sql, calls } = fakeSql([raw()]);
    await getAuditPage(sql, {
      q: "o'brien; drop table users",
      leaveTypeId: "10000000-0000-4000-8000-000000000001",
      status: "deleted",
      decidedBy: "00000000-0000-4000-8000-000000000002",
      from: "2026-01-01",
      to: "2026-12-31",
      page: 2,
    });
    const { text, values } = calls[0]!;
    expect(text).not.toContain("drop table");
    expect(values).toContain("%o'brien; drop table users%");
    expect(values).toContain("deleted");
    expect(values).toContain("2026-01-01");
    expect(values).toContain(25); // the offset of page 2 and the page size
  });

  it("puts a soft-deleted request in the deleted bucket only, so the buckets add up", async () => {
    const { sql, calls } = fakeSql([raw()]);
    await getAuditPage(sql, NONE);
    expect(calls[0]!.text).toContain(
      "case when r.is_deleted then 'deleted' else r.status::text end as bucket",
    );
  });

  it("matches a date range on ANY audit event, with UTC bounds", async () => {
    const { sql, calls } = fakeSql([raw()]);
    await getAuditPage(sql, NONE);
    expect(calls[0]!.text).toContain("from public.audit_log e");
    expect(calls[0]!.text).toContain("at time zone 'UTC'");
  });

  it("maps the rows, counting working days, and returns the counts", async () => {
    const { sql } = fakeSql([
      raw({ total: 48, approved: 32, rejected: 7, pending: 6, deleted: 3 }),
    ]);
    const out = await getAuditPage(sql, NONE);
    expect(out.counts).toEqual({ total: 48, approved: 32, rejected: 7, pending: 6, deleted: 3 });
    expect(out.rows[0]).toMatchObject({ id: "r1", workingDays: 3, employeeName: "Elena Cruz" });
  });

  it("shows the last page when the page asked for is past the end", async () => {
    const { sql } = fakeSql([raw({ total: 30 })]);
    expect((await getAuditPage(sql, { ...NONE, page: 9 })).page).toBe(2);
    expect((await getAuditPage(sql, { ...NONE, page: 1 })).page).toBe(1);
  });

  it("an empty result is page 1 with zero counts", async () => {
    const { sql } = fakeSql([raw({ total: 0, approved: 0, rows: [] })]);
    const out = await getAuditPage(sql, { ...NONE, page: 4 });
    expect(out.page).toBe(1);
    expect(out.rows).toEqual([]);
  });
});

describe("likePattern", () => {
  it("matches a typed name literally: % and _ and backslash are escaped", () => {
    expect(likePattern("elena")).toBe("%elena%");
    expect(likePattern("50%_off")).toBe("%50\\%\\_off%");
    expect(likePattern("a\\b")).toBe("%a\\\\b%");
  });
});

describe("getAuditFilterChoices", () => {
  it("reads the leave types and the people who have decided requests in one statement", async () => {
    const choices = {
      leaveTypes: [{ id: "t", name: "Vacation" }],
      deciders: [],
      employeeNames: ["Elena Cruz"],
    };
    const { sql, calls } = fakeSql([choices]);
    expect(await getAuditFilterChoices(sql)).toEqual(choices);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).not.toMatch(/\b(insert|update|delete)\b/i);
  });
});
