import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FilterShell } from "@/components/ui/filter-shell";
import {
  DEFAULT_OVERRIDE_QUERY,
  parseOverrideListQuery,
  type OverrideListQuery,
} from "@/lib/leave/override-list-schema";
import type { OverrideQueueRow, RecentOverrideView } from "@/lib/leave/override-queue";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
const { OverriddenList, WaitingList } = await import("./override-table");
const source = readFileSync(new URL("./override-table.tsx", import.meta.url), "utf8");

const NOW = new Date("2026-10-19T09:00:00Z");
const row = (over: Partial<OverrideQueueRow> = {}): OverrideQueueRow => ({
  id: "r1",
  employee_name: "Elena Cruz",
  manager_name: "Marco Santos",
  leave_type_name: "Vacation",
  start_date: "2026-11-02",
  end_date: "2026-11-04",
  reason: "Family trip",
  created_at: new Date("2026-10-14T00:00:00Z"),
  working_days: 3,
  balance: "0.00",
  shortfall: "3.00",
  ...over,
});
const waiting = (rows: OverrideQueueRow[], query: Partial<OverrideListQuery> = {}) =>
  renderToStaticMarkup(
    createElement(
      FilterShell,
      null,
      createElement(WaitingList, {
        rows,
        query: { ...DEFAULT_OVERRIDE_QUERY, ...query },
        now: NOW,
        timeZone: "Asia/Manila",
      }),
    ),
  );

describe("WaitingList (EPIC-14 AC1, AC5)", () => {
  const html = waiting([
    row(),
    row({
      id: "r2",
      employee_name: "Daniel Kim",
      manager_name: null,
      reason: "",
      balance: "2.00",
      shortfall: "1.00",
    }),
  ]);

  it("is a real table from xl and cards below, with scoped headers and the employee as the row header", () => {
    expect(html).toMatch(/<div class="hidden[^"]*xl:block">\s*<table/);
    expect(html).toMatch(/<ul[^>]*class="[^"]*xl:hidden"/);
    expect(html.match(/aria-label="Requests waiting for an override"/g)).toHaveLength(2);
    for (const label of ["Employee", "Dates", "Over balance", "Submitted", "Actions"])
      expect(html).toMatch(new RegExp(`<th[^>]*scope="col"[^>]*>(<a[^>]*>)?(<span>)?${label}`));
    expect(html.match(/<th[^>]*scope="row"/g)).toHaveLength(2);
    expect(html).toContain("sticky top-0");
  });

  it("every sortable header links to its sort, the sorted one marks aria-sort, and shortfall starts biggest first", () => {
    expect(html.match(/aria-sort="ascending"/g)).toHaveLength(1);
    expect(html).toContain('href="/approvals/overrides?sort=shortfall"');
    expect(html).toContain('href="/approvals/overrides?sort=name"');
    expect(html).toContain('href="/approvals/overrides?sort=start"');
    const byShortfall = waiting([row()], { sort: "shortfall", dir: "desc" });
    expect(byShortfall).toMatch(
      /aria-sort="descending"[^>]*><a href="\/approvals\/overrides\?sort=shortfall&amp;dir=asc"/,
    );
  });

  it("writes the shortfall, the balance and what approving does in words, with the manager and the reason", () => {
    expect(html).toContain("Over balance by 3 days");
    expect(html).toContain("Vacation balance is 0 days.");
    expect(html).toContain(
      "Approving keeps their Vacation balance at 0 and records a shortfall of 3 days in the audit history.",
    );
    expect(html).toContain("Approving uses all of their 2 days of Vacation");
    expect(html).toContain("Manager: Marco Santos");
    expect(html).toContain("Manager: No manager");
    expect(html).toContain("Reason: Family trip");
  });

  it("offers Approve override and Reject on every request, in both structures, through the same client component", () => {
    expect(html.match(/>Approve override</g)).toHaveLength(4);
    expect(html.match(/>Reject</g)).toHaveLength(4);
    expect(source).toContain('endpoint="override"');
    expect(source).toContain('approveLabel="Approve override"');
    expect(source).not.toMatch(/fetch\(/);
  });

  it("shows when it was submitted in the app's time zone, and uses tokens only", () => {
    expect(html).toContain("Oct 14 · 8:00 AM");
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(|style=/);
  });
});

describe("OverriddenList (EPIC-14)", () => {
  const done: RecentOverrideView = {
    id: "a1",
    employee_name: "Elena Cruz",
    leave_type_name: "Sick",
    start_date: "2026-12-08",
    end_date: "2026-12-12",
    approved_by_name: "Hana Reyes",
    occurred_at: new Date("2026-10-03T10:00:00Z"),
    days_requested: "5.00",
    shortfall: "5.00",
  };
  const out = renderToStaticMarkup(
    createElement(
      FilterShell,
      null,
      createElement(OverriddenList, {
        rows: [done],
        query: parseOverrideListQuery({ view: "overridden" }).query,
        now: NOW,
        timeZone: "Asia/Manila",
      }),
    ),
  );

  it("is a table from xl and cards below, read-only, sorted by the latest approval first", () => {
    expect(out).toMatch(/<div class="hidden[^"]*xl:block">\s*<table/);
    expect(out).toMatch(/<ul[^>]*class="[^"]*xl:hidden"/);
    for (const label of ["Employee", "Dates", "Shortfall", "Approved"])
      expect(out).toMatch(new RegExp(`<th[^>]*scope="col"[^>]*>(<a[^>]*>)?(<span>)?${label}`));
    expect(out).toMatch(
      /aria-sort="descending"[^>]*><a href="\/approvals\/overrides\?view=overridden&amp;dir=asc"/,
    );
    expect(out).not.toContain(">Approve override<");
    expect(out).not.toContain(">Reject<");
  });

  it("writes the shortfall, who approved and when, with no reason or note", () => {
    expect(out).toContain("Approved (HR override)");
    expect(out).toContain("Shortfall: 5 days");
    expect(out).toContain("5 working days");
    expect(out).toContain("By Hana Reyes");
    expect(out).toContain("Oct 3 · 6:00 PM");
    expect(out).not.toContain("Reason:");
  });
});
