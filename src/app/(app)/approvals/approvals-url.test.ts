import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEAM_QUERY,
  parseTeamQueueQuery,
  type TeamQueueQuery,
} from "@/lib/leave/team-queue-schema";
import {
  approvalsHref,
  clearedHref,
  filterChips,
  PENDING_STATUS_LABEL,
  SORT_OPTIONS,
  sortHref,
  viewHref,
} from "./approvals-url";

const Q = DEFAULT_TEAM_QUERY;
const DECIDED = parseTeamQueueQuery({ view: "decided" }).query;
const TYPE = "10000000-0000-4000-8000-000000000001";

describe("approvalsHref", () => {
  it("writes only non-default values", () => {
    expect(approvalsHref(Q)).toBe("/approvals");
    expect(approvalsHref({ ...Q, q: "ana" }, 3)).toBe("/approvals?q=ana&page=3");
    expect(approvalsHref(DECIDED)).toBe("/approvals?view=decided");
    expect(approvalsHref({ ...Q, q: "a&b" })).toBe("/approvals?q=a%26b");
  });

  it("writes the filters, the dates, the page size and an order that is not the default", () => {
    expect(
      approvalsHref({
        ...Q,
        type: TYPE,
        status: "over",
        from: "2026-11-01",
        to: "2026-11-30",
        per: 50,
      }),
    ).toBe(`/approvals?type=${TYPE}&status=over&from=2026-11-01&to=2026-11-30&per=50`);
    expect(approvalsHref({ ...Q, sort: "days", dir: "desc" })).toBe("/approvals?sort=days");
    expect(approvalsHref({ ...Q, sort: "days", dir: "asc" })).toBe("/approvals?sort=days&dir=asc");
    expect(approvalsHref({ ...Q, dir: "desc" })).toBe("/approvals?dir=desc");
    expect(approvalsHref({ ...DECIDED, sort: "name", dir: "asc" })).toBe(
      "/approvals?view=decided&sort=name",
    );
  });

  it("round-trips through the parser, in both views", () => {
    const queries: TeamQueueQuery[] = [
      {
        ...Q,
        q: "ana",
        type: TYPE,
        status: "blocked",
        from: "2026-11-01",
        to: "2026-11-30",
        sort: "start",
        dir: "desc",
        per: 100,
      },
      { ...DECIDED, q: "ben", status: "overridden", sort: "decided", dir: "asc", per: 50 },
    ];
    for (const query of queries) {
      const url = new URL(approvalsHref(query), "http://x");
      expect(parseTeamQueueQuery(Object.fromEntries(url.searchParams)).query).toEqual(query);
    }
  });
});

describe("viewHref, sortHref and clearedHref", () => {
  it("switching view drops every filter", () => {
    expect(viewHref("pending")).toBe("/approvals");
    expect(viewHref("decided")).toBe("/approvals?view=decided");
  });

  it("a first click sorts in the column's starting direction, a second reverses it, and a sort goes back to page 1", () => {
    expect(sortHref(Q, "name")).toBe("/approvals?sort=name");
    expect(sortHref({ ...Q, sort: "name", dir: "asc" }, "name")).toBe(
      "/approvals?sort=name&dir=desc",
    );
    expect(sortHref(Q, "created")).toBe("/approvals?dir=desc"); // the default sort, reversed
    expect(sortHref({ ...Q, q: "x", status: "ok", page: 4 }, "start")).toBe(
      "/approvals?q=x&status=ok&sort=start",
    );
    expect(sortHref(DECIDED, "decided")).toBe("/approvals?view=decided&dir=asc");
  });

  it("clearing removes every filter but keeps the view, order and page size", () => {
    expect(
      clearedHref({
        ...DECIDED,
        q: "x",
        type: TYPE,
        status: "rejected",
        from: "2026-11-01",
        to: "2026-11-30",
        sort: "name",
        dir: "asc",
        per: 50,
      }),
    ).toBe("/approvals?view=decided&sort=name&per=50");
  });
});

describe("filterChips and the choices", () => {
  const names = { types: { [TYPE]: "Vacation" } };

  it("has one removable chip per applied filter, each link dropping only that filter", () => {
    const query = {
      ...Q,
      q: "ana",
      type: TYPE,
      status: "over" as const,
      from: "2026-11-02",
      to: "2026-11-30",
      sort: "name" as const,
    };
    const chips = filterChips(query, names);
    expect(chips.map((c) => c.label)).toEqual([
      "Name: ana",
      "Leave type: Vacation",
      "Status: Waiting for HR override",
      "From Nov 2, 2026",
      "To Nov 30, 2026",
    ]);
    expect(chips[0]!.href).toBe(
      `/approvals?type=${TYPE}&status=over&from=2026-11-02&to=2026-11-30&sort=name`,
    );
    expect(chips[2]!.href).toBe(
      `/approvals?q=ana&type=${TYPE}&from=2026-11-02&to=2026-11-30&sort=name`,
    );
  });

  it("the decided view labels its own statuses", () => {
    const chips = filterChips({ ...DECIDED, status: "overridden" }, names);
    expect(chips[0]!.label).toBe("Status: Approved (HR override)");
    expect(chips[0]!.href).toBe("/approvals?view=decided");
  });

  it("no chips without filters, and Unknown for a leave type that is not in the list", () => {
    expect(filterChips({ ...Q, sort: "name" }, names)).toEqual([]);
    expect(filterChips({ ...Q, type: "gone" }, names)[0]!.label).toBe("Leave type: Unknown");
  });

  it("every sort option of a view is accepted by that view's parser", () => {
    for (const view of ["pending", "decided"] as const)
      for (const { value } of SORT_OPTIONS[view]) {
        const [sort, dir] = value.split(":");
        const r = parseTeamQueueQuery({ view, sort, dir });
        expect(r.ignored, `${view} ${value}`).toEqual([]);
      }
    expect(PENDING_STATUS_LABEL.blocked).toBe("Needs a balance fix");
  });
});
