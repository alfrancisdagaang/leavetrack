import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AuditListRow } from "@/lib/leave/audit-list";
import type { AuditListQuery } from "@/lib/leave/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const { FilterShell } = await import("@/components/ui/filter-shell");
const { AuditFilters } = await import("./audit-filters");
const { AuditSummary } = await import("./audit-summary");
const { AuditTable } = await import("./audit-table");
const { AuditEmpty, AuditError, AuditNoMatches } = await import("./audit-states");
const { AuditSkeleton } = await import("./audit-skeleton");

const T = "10000000-0000-4000-8000-000000000001";
const NONE: AuditListQuery = {
  q: undefined,
  leaveTypeId: undefined,
  status: undefined,
  decidedBy: undefined,
  from: undefined,
  to: undefined,
  page: 1,
};
const choices = {
  leaveTypes: [
    { id: T, name: "Vacation" },
    { id: "t2", name: "Sick" },
  ],
  deciders: [{ id: "u2", name: "Marco Santos", role: "manager" as const }],
  employeeNames: ["Elena Cruz", "Jun Bautista"],
};

const row = (over: Partial<AuditListRow> = {}): AuditListRow => ({
  id: "r1",
  employeeId: "e1",
  employeeName: "Elena Cruz",
  employeeRole: "employee",
  leaveTypeName: "Vacation",
  startDate: "2026-11-02",
  endDate: "2026-11-04",
  workingDays: 3,
  status: "approved",
  isDeleted: false,
  decidedByName: "Marco Santos",
  decidedByRole: "manager",
  decidedAt: "2026-10-18T09:12:00+00:00",
  createdAt: "2026-10-17T08:00:00+00:00",
  overridden: false,
  ...over,
});

const filters = (query: AuditListQuery) =>
  renderToStaticMarkup(
    createElement(FilterShell, null, createElement(AuditFilters, { query, choices })),
  );

describe("AuditFilters (US-14)", () => {
  it("is a labelled GET form to /audit, so it works without JavaScript", () => {
    const out = filters(NONE);
    expect(out).toMatch(/<form[^>]*method="get"/);
    expect(out).toContain('action="/audit"');
    expect(out).toContain('aria-label="Filter audit log"');
  });

  it("labels every field, and offers the real choices", () => {
    const out = filters(NONE);
    for (const label of [
      "Employee name",
      "Leave type",
      "Status",
      "Decided by",
      "From (optional)",
      "To (optional)",
    ])
      expect(out).toContain(label);
    for (const name of ["q", "type", "status", "by", "from", "to"])
      expect(out).toContain(`name="${name}"`);
    expect(out).toContain("Removed (soft-deleted)");
    expect(out).toContain("Marco Santos");
    expect(out).toContain("Days are UTC");
    expect(out).toContain("Apply filters");
    expect(out).toContain("Clear filters");
  });

  it("shows no chips when nothing is applied, and a chip per filter, each removable, when set", () => {
    expect(filters(NONE)).not.toContain("Applied filters");
    const out = filters({
      ...NONE,
      q: "elena",
      leaveTypeId: T,
      status: "pending",
      from: "2026-01-01",
    });
    expect(out).toContain('aria-label="Applied filters"');
    for (const chip of [
      "Search: elena",
      "Leave type: Vacation",
      "Status: Pending",
      "From: Jan 1, 2026",
    ]) {
      expect(out).toContain(chip);
      expect(out).toContain(`aria-label="Remove filter ${chip}"`);
    }
    expect(out).toContain("Clear all");
  });

  it("shows the applied values in the fields", () => {
    const out = filters({ ...NONE, q: "elena", status: "deleted", to: "2026-02-01" });
    expect(out).toMatch(/name="q"[^>]*value="elena"|value="elena"[^>]*name="q"/);
    expect(out).toMatch(/<option value="deleted" selected/);
    expect(out).toContain('value="2026-02-01"');
  });
});

describe("AuditSummary", () => {
  it("labels each figure in text and shows them all", () => {
    const out = renderToStaticMarkup(
      createElement(AuditSummary, {
        counts: { total: 48, approved: 32, rejected: 7, pending: 6, deleted: 3 },
      }),
    );
    for (const t of [
      "Total requests",
      "Approved",
      "Rejected",
      "Pending",
      "Removed",
      "48",
      "32",
      "7",
      "6",
      "3",
    ])
      expect(out).toContain(t);
  });
});

describe("AuditTable", () => {
  const render = (rows: AuditListRow[], total = rows.length) =>
    renderToStaticMarkup(createElement(AuditTable, { rows, total }));

  it("has a real table with column headers and the same rows stacked for phones", () => {
    const out = render([row()]);
    expect(out).toMatch(/<table[^>]*class="[^"]*hidden[^"]*"/);
    for (const h of [
      "Employee",
      "Leave type",
      "Date range",
      "Working days",
      "Status",
      "Decided by",
      "Decided at",
    ])
      expect(out).toContain(`>${h}</th>`);
    expect(out).toContain('<ul aria-label="Leave requests"');
    expect(out.match(/Elena Cruz/g)).toHaveLength(2); // table and stacked row
    expect(out).toContain("1 request");
  });

  it("shows the person, type, dates, days, decision-maker and the time in UTC", () => {
    const out = render([row()]);
    for (const t of [
      "Elena Cruz",
      "Employee",
      "Vacation",
      "Nov 2 to Nov 4, 2026",
      "3 working days",
      "Approved",
      "Marco Santos",
      "Manager",
      "Oct 18, 2026, 09:12 UTC",
    ])
      expect(out).toContain(t);
  });

  it("says a pending request awaits a decision", () => {
    const out = render([
      row({ status: "pending", decidedByName: null, decidedByRole: null, decidedAt: null }),
    ]);
    expect(out).toContain("Pending");
    expect(out).toContain("Awaiting decision");
    expect(out).toContain("Not decided");
  });

  it("writes a soft-deleted request as removed, never as its old status", () => {
    const out = render([row({ isDeleted: true })]);
    expect(out).toContain("Removed (soft-deleted)");
    expect(out).not.toContain(">Approved<");
  });

  it("never shows a reason, and carries no width cap or hard-coded colour", () => {
    const out = render([row()]);
    expect(out).not.toMatch(/Reason/i);
    expect(out).not.toContain("max-w-5xl");
    expect(out).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });
});

describe("states and skeleton", () => {
  it("error: an alert with a way to retry", () => {
    const out = renderToStaticMarkup(createElement(AuditError, { retryHref: "/audit?page=2" }));
    expect(out).toContain('role="alert"');
    expect(out).toContain("could not be loaded");
    expect(out).toContain('href="/audit?page=2"');
  });

  it("no matches: says so and clears the filters; empty: says there are no requests", () => {
    const out = renderToStaticMarkup(createElement(AuditNoMatches, { clearHref: "/audit" }));
    expect(out).toContain("No requests match these filters.");
    expect(out).toContain('href="/audit"');
    expect(renderToStaticMarkup(createElement(AuditEmpty))).toContain(
      "There are no leave requests yet.",
    );
  });

  it("the skeleton is decorative and has no width cap", () => {
    const out = renderToStaticMarkup(createElement(AuditSkeleton));
    expect(out).toContain('aria-hidden="true"');
    expect(out).not.toContain("max-w-5xl");
  });
});

describe("AuditFilters name suggestions", () => {
  it("offers the employees' names as native suggestions on the search box, which still works as plain text", () => {
    const out = filters(NONE);
    expect(out).toMatch(/<input[^>]*list="audit-employee-names"/);
    expect(out).toMatch(/autoComplete="off"|autocomplete="off"/);
    expect(out).toContain(
      '<datalist id="audit-employee-names"><option value="Elena Cruz"></option><option value="Jun Bautista"></option></datalist>',
    );
  });
});
