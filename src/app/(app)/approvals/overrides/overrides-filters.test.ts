import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FilterShell } from "@/components/ui/filter-shell";
import {
  DEFAULT_OVERRIDE_QUERY,
  parseOverrideListQuery,
  type OverrideListQuery,
} from "@/lib/leave/override-list-schema";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
const { OverridesFilters } = await import("./overrides-filters");

const TYPE = "10000000-0000-4000-8000-000000000001";
const TEAM = "00000000-0000-4000-8000-000000000002";
const choices = {
  leaveTypes: [
    { id: "10000000-0000-4000-8000-000000000002", name: "Sick" },
    { id: TYPE, name: "Vacation" },
  ],
  managers: [
    { id: TEAM, name: "Marco Santos" },
    { id: "00000000-0000-4000-8000-000000000004", name: "Priya Nair" },
  ],
};
const render = (
  query: Partial<OverrideListQuery> = {},
  view: "waiting" | "overridden" = "waiting",
) =>
  renderToStaticMarkup(
    createElement(
      FilterShell,
      null,
      createElement(OverridesFilters, {
        query: {
          ...(view === "waiting" ? DEFAULT_OVERRIDE_QUERY : parseOverrideListQuery({ view }).query),
          ...query,
        },
        choices,
      }),
    ),
  );

describe("OverridesFilters (EPIC-14 AC1)", () => {
  it("has a labelled control for every filter, including the team, in a plain GET search form", () => {
    const html = render();
    for (const [id, label] of [
      ["overrides-q", "Search by employee name"],
      ["overrides-type", "Leave type"],
      ["overrides-team", "Team \\(manager\\)"],
      ["overrides-order", "Sort by"],
      ["overrides-from", "Leave from"],
      ["overrides-to", "Leave to"],
      ["overrides-per", "Rows per page"],
    ])
      expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>${label}</label>`));
    expect(html).toMatch(/<form[^>]*action="\/approvals\/overrides"/);
    expect(html).toContain('role="search"');
  });

  it("offers every manager with employees and the leave types that track a balance, and the sorts of the view", () => {
    const html = render();
    for (const t of [
      "All teams",
      "Marco Santos",
      "Priya Nair",
      "Sick",
      "Vacation",
      "Biggest shortfall first",
      "Oldest request first",
    ])
      expect(html, t).toContain(t);
    expect(html).not.toContain("Latest approval first");
    const done = render({}, "overridden");
    expect(done).toContain("Latest approval first");
    expect(done).not.toContain("Oldest request first");
  });

  it("shows what is applied: selected values and a chip per filter, each dropping only itself", () => {
    const html = render({
      team: TEAM,
      type: TYPE,
      q: "ana",
      from: "2026-11-02",
      sort: "shortfall",
      dir: "desc",
    });
    expect(html).toMatch(new RegExp(`<option value="${TEAM}" selected`));
    expect(html).toMatch(/<option value="shortfall:desc" selected/);
    for (const chip of [
      "Name: ana",
      "Leave type: Vacation",
      "Team: Marco Santos",
      "From Nov 2, 2026",
    ])
      expect(html).toContain(`aria-label="Remove filter ${chip}"`);
    expect(html).toContain(
      `href="/approvals/overrides?q=ana&amp;type=${TYPE}&amp;from=2026-11-02&amp;sort=shortfall"`,
    );
  });

  it("opens the selects on a phone only when a filter is applied", () => {
    expect(render()).toMatch(/aria-expanded="false"[^>]*aria-controls="overrides-selects"/);
    expect(render({ team: TEAM })).toMatch(/aria-expanded="true"/);
  });
});
