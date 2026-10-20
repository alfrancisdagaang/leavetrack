import { describe, expect, it } from "vitest";
import {
  DEFAULT_OVERRIDE_QUERY,
  parseOverrideListQuery,
  type OverrideListQuery,
} from "@/lib/leave/override-list-schema";
import {
  clearedHref,
  filterChips,
  overridesHref,
  SORT_OPTIONS,
  sortHref,
  viewHref,
} from "./overrides-url";

const Q = DEFAULT_OVERRIDE_QUERY;
const DONE = parseOverrideListQuery({ view: "overridden" }).query;
const TYPE = "10000000-0000-4000-8000-000000000001";
const TEAM = "00000000-0000-4000-8000-000000000002";

describe("overridesHref", () => {
  it("writes only non-default values", () => {
    expect(overridesHref(Q)).toBe("/approvals/overrides");
    expect(overridesHref({ ...Q, q: "ana" }, 3)).toBe("/approvals/overrides?q=ana&page=3");
    expect(overridesHref(DONE)).toBe("/approvals/overrides?view=overridden");
  });

  it("writes the filters, the team, the dates, the page size and a non-default order", () => {
    expect(
      overridesHref({
        ...Q,
        type: TYPE,
        team: TEAM,
        from: "2026-11-01",
        to: "2026-11-30",
        per: 100,
      }),
    ).toBe(`/approvals/overrides?type=${TYPE}&team=${TEAM}&from=2026-11-01&to=2026-11-30&per=100`);
    expect(overridesHref({ ...Q, sort: "shortfall", dir: "desc" })).toBe(
      "/approvals/overrides?sort=shortfall",
    );
    expect(overridesHref({ ...Q, sort: "shortfall", dir: "asc" })).toBe(
      "/approvals/overrides?sort=shortfall&dir=asc",
    );
    expect(overridesHref({ ...DONE, sort: "name", dir: "asc" })).toBe(
      "/approvals/overrides?view=overridden&sort=name",
    );
  });

  it("round-trips through the parser, in both views", () => {
    const queries: OverrideListQuery[] = [
      {
        ...Q,
        q: "ana",
        type: TYPE,
        team: TEAM,
        from: "2026-11-01",
        to: "2026-11-30",
        sort: "shortfall",
        dir: "asc",
        per: 50,
      },
      { ...DONE, q: "ben", team: TEAM, sort: "approved", dir: "asc" },
    ];
    for (const query of queries) {
      const url = new URL(overridesHref(query), "http://x");
      expect(parseOverrideListQuery(Object.fromEntries(url.searchParams)).query).toEqual(query);
    }
  });
});

describe("viewHref, sortHref and clearedHref", () => {
  it("switching view drops every filter", () => {
    expect(viewHref("waiting")).toBe("/approvals/overrides");
    expect(viewHref("overridden")).toBe("/approvals/overrides?view=overridden");
  });

  it("a first click sorts in the column's starting direction, a second reverses it, and a sort goes back to page 1", () => {
    expect(sortHref(Q, "shortfall")).toBe("/approvals/overrides?sort=shortfall");
    expect(sortHref({ ...Q, sort: "shortfall", dir: "desc" }, "shortfall")).toBe(
      "/approvals/overrides?sort=shortfall&dir=asc",
    );
    expect(sortHref({ ...Q, q: "x", team: TEAM, page: 3 }, "name")).toBe(
      `/approvals/overrides?q=x&team=${TEAM}&sort=name`,
    );
  });

  it("clearing removes every filter but keeps the view, order and page size", () => {
    expect(
      clearedHref({
        ...DONE,
        q: "x",
        type: TYPE,
        team: TEAM,
        from: "2026-11-01",
        to: "2026-11-30",
        sort: "shortfall",
        per: 50,
      }),
    ).toBe("/approvals/overrides?view=overridden&sort=shortfall&per=50");
  });
});

describe("filterChips and the choices", () => {
  const names = { types: { [TYPE]: "Vacation" }, teams: { [TEAM]: "Marco Santos" } };

  it("has one removable chip per applied filter, each link dropping only that filter", () => {
    const chips = filterChips(
      { ...Q, q: "ana", type: TYPE, team: TEAM, from: "2026-11-02", to: "2026-11-30" },
      names,
    );
    expect(chips.map((c) => c.label)).toEqual([
      "Name: ana",
      "Leave type: Vacation",
      "Team: Marco Santos",
      "From Nov 2, 2026",
      "To Nov 30, 2026",
    ]);
    expect(chips[2]!.href).toBe(
      `/approvals/overrides?q=ana&type=${TYPE}&from=2026-11-02&to=2026-11-30`,
    );
  });

  it("no chips without filters, and Unknown for a team that is not in the list", () => {
    expect(filterChips(Q, names)).toEqual([]);
    expect(filterChips({ ...Q, team: "gone" }, names)[0]!.label).toBe("Team: Unknown");
  });

  it("every sort option of a view is accepted by that view's parser", () => {
    for (const view of ["waiting", "overridden"] as const)
      for (const { value } of SORT_OPTIONS[view]) {
        const [sort, dir] = value.split(":");
        expect(parseOverrideListQuery({ view, sort, dir }).ignored, `${view} ${value}`).toEqual([]);
      }
  });
});
