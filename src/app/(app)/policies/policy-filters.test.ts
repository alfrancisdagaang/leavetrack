import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FilterShell } from "@/components/ui/filter-shell";
import { DEFAULT_POLICY_QUERY, type PolicyListQuery } from "@/lib/leave/policies-schema";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
const { PolicyFilters } = await import("./policy-filters");
const source = readFileSync(new URL("./policy-filters.tsx", import.meta.url), "utf8");

const TEAM = "00000000-0000-4000-8000-000000000002";
const VAC = "10000000-0000-4000-8000-000000000001";
const choices = {
  managers: [
    { id: TEAM, name: "Marco Santos" },
    { id: "00000000-0000-4000-8000-000000000004", name: "Priya Nair" },
  ],
  leaveTypes: [
    { id: "10000000-0000-4000-8000-000000000002", name: "Sick" },
    { id: VAC, name: "Vacation" },
  ],
};
const render = (query: Partial<PolicyListQuery> = {}) =>
  renderToStaticMarkup(
    createElement(
      FilterShell,
      null,
      createElement(PolicyFilters, { query: { ...DEFAULT_POLICY_QUERY, ...query }, choices }),
    ),
  );

describe("PolicyFilters (EPIC-13 AC1)", () => {
  it("has a labelled control for every filter, in a search form that also works as a plain GET form", () => {
    const html = render();
    for (const [id, label] of [
      ["policy-q", "Search employees by name"],
      ["policy-team", "Team \\(manager\\)"],
      ["policy-type", "Leave type"],
      ["policy-status", "Status"],
      ["policy-order", "Sort by"],
      ["policy-per", "Rows per page"],
    ])
      expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>${label}</label>`));
    expect(html).toMatch(/<form[^>]*method="get"/);
    expect(html).toMatch(/<form[^>]*action="\/policies"/);
    expect(html).toContain('role="search"');
    expect(html).toContain("<noscript>");
  });

  it("offers every manager with employees, the accruing leave types, the statuses and the page sizes", () => {
    const html = render();
    for (const text of [
      "All teams",
      "Marco Santos",
      "Priya Nair",
      "All types",
      "Sick",
      "Vacation",
      "All statuses",
      "No policy yet",
      "Has a policy",
      "Changed this month",
      "Name A to Z",
      "Vacation rate, high to low",
      "Last changed, newest first",
    ])
      expect(html, text).toContain(text);
    expect(html).toMatch(/<option value="25" selected/);
    for (const n of [50, 100]) expect(html).toContain(`<option value="${n}"`);
  });

  it("shows what is applied: the selected values and a removable chip per filter", () => {
    const html = render({
      team: TEAM,
      type: VAC,
      status: "none",
      q: "ana",
      sort: "vacation",
      dir: "desc",
      per: 50,
    });
    expect(html).toMatch(new RegExp(`<option value="${TEAM}" selected`));
    expect(html).toMatch(/<option value="none" selected/);
    expect(html).toMatch(/<option value="vacation:desc" selected/);
    expect(html).toMatch(/<option value="50" selected/);
    expect(html).toContain('value="ana"');
    for (const chip of [
      "Name: ana",
      "Team: Marco Santos",
      "Leave type: Vacation",
      "Status: No policy yet",
    ])
      expect(html).toContain(`aria-label="Remove filter ${chip}"`);
    expect(html).toContain("Clear all");
  });

  it("with no filter there are no chips and no Clear all, even when only the order is not the default", () => {
    const html = render({ sort: "sick", dir: "desc", per: 100 });
    expect(html).not.toContain("Applied filters");
    expect(html).not.toContain("Clear all");
  });

  it("a chip removes only its own filter and keeps the order and page size", () => {
    const html = render({ team: TEAM, status: "none", sort: "sick", per: 50 });
    expect(html).toContain(`href="/policies?status=none&amp;sort=sick&amp;per=50"`);
  });

  it("a select applies as soon as it changes (the form's change handler), and the search on submit", () => {
    expect(source).toMatch(
      /onChange=\{\(event\) => \{\s*if \(event\.target instanceof HTMLSelectElement\) apply\(event\.currentTarget\);/,
    );
    expect(source).toMatch(
      /onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\);\s*apply\(event\.currentTarget\);/,
    );
  });

  it("every change starts again at page 1", () => {
    expect(source).toMatch(/policiesHref\(\{[^}]*page: 1,/s);
  });

  it("on a phone the five selects sit behind a Filters button that says whether it is open", () => {
    const closed = render();
    expect(closed).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="policy-selects"/);
    expect(closed).toMatch(/id="policy-selects"[^>]*class="hidden[^"]*sm:grid/);
    const open = render({ team: TEAM });
    expect(open).toMatch(/<button[^>]*aria-expanded="true"/);
    expect(open).toMatch(/id="policy-selects"[^>]*class="grid /);
  });

  it("the search box is never inside the collapsed part", () => {
    const html = render();
    expect(html.indexOf('id="policy-q"')).toBeLessThan(html.indexOf('id="policy-selects"'));
  });
});
