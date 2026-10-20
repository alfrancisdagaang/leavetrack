import { describe, expect, it } from "vitest";
import type { PolicyChangeView } from "@/lib/leave/policies";
import { DEFAULT_POLICY_QUERY, parsePolicyQuery } from "@/lib/leave/policies-schema";
import {
  describeChange,
  formatLastChange,
  formatRate,
  formatWhen,
  policyStatus,
} from "./policy-format";
import { clearedHref, filterChips, policiesHref, sortHref } from "./policies-url";

const change = (over: Partial<PolicyChangeView> = {}): PolicyChangeView => ({
  id: "c1",
  employeeName: "Elena Cruz",
  leaveTypeName: "Vacation",
  changedByName: "Hana Reyes",
  oldRate: "1.25",
  newRate: "1.50",
  changedAt: "2026-10-20T01:41:00.000Z",
  ...over,
});

describe("formatRate", () => {
  it.each([
    ["1.50", "1.5"],
    ["2.00", "2"],
    ["0.00", "0"],
    ["1.25", "1.25"],
  ])("%s reads %s", (a, b) => expect(formatRate(a)).toBe(b));
});

describe("describeChange", () => {
  it("says from and to for a change", () => {
    expect(describeChange(change())).toBe(
      "Hana Reyes changed Elena Cruz's Vacation rate from 1.25 to 1.5 days a month",
    );
  });
  it("says set for a first policy", () => {
    expect(describeChange(change({ oldRate: null }))).toBe(
      "Hana Reyes set Elena Cruz's Vacation rate to 1.5 days a month",
    );
  });
});

describe("formatWhen", () => {
  it("writes the date and time in the given zone", () => {
    expect(formatWhen("2026-10-20T01:41:00.000Z", "Asia/Manila")).toBe("Oct 20, 2026, 9:41 AM");
    expect(formatWhen("2026-10-20T01:41:00.000Z", "UTC")).toBe("Oct 20, 2026, 1:41 AM");
  });
});

const Q = DEFAULT_POLICY_QUERY;

describe("policiesHref", () => {
  it("writes only non-default values", () => {
    expect(policiesHref(Q)).toBe("/policies");
    expect(policiesHref({ ...Q, q: "ana" }, 3)).toBe("/policies?q=ana&page=3");
    expect(policiesHref(Q, 2)).toBe("/policies?page=2");
    expect(policiesHref({ ...Q, q: "a&b" })).toBe("/policies?q=a%26b");
  });

  it("writes the filters, the page size and an order that is not the default", () => {
    const team = "00000000-0000-4000-8000-000000000002";
    expect(policiesHref({ ...Q, team, status: "none", per: 50 })).toBe(
      `/policies?team=${team}&status=none&per=50`,
    );
    expect(policiesHref({ ...Q, sort: "vacation", dir: "asc" })).toBe("/policies?sort=vacation");
    expect(policiesHref({ ...Q, sort: "vacation", dir: "desc" })).toBe(
      "/policies?sort=vacation&dir=desc",
    );
    expect(policiesHref({ ...Q, sort: "changed", dir: "desc" })).toBe("/policies?sort=changed");
    expect(policiesHref({ ...Q, sort: "name", dir: "desc" })).toBe("/policies?dir=desc");
  });

  it("round-trips through the parser", () => {
    const query = {
      ...Q,
      q: "ana",
      per: 100 as const,
      sort: "sick" as const,
      dir: "desc" as const,
      status: "has" as const,
    };
    const url = new URL(policiesHref(query), "http://x");
    const parsed = parsePolicyQuery(Object.fromEntries(url.searchParams));
    expect(parsed.query).toEqual(query);
  });
});

describe("sortHref and clearedHref", () => {
  it("a first click sorts in the column's starting direction, a second reverses it", () => {
    expect(sortHref(Q, "vacation")).toBe("/policies?sort=vacation");
    expect(sortHref({ ...Q, sort: "vacation", dir: "asc" }, "vacation")).toBe(
      "/policies?sort=vacation&dir=desc",
    );
    expect(sortHref({ ...Q, sort: "name", dir: "asc" }, "name")).toBe("/policies?dir=desc");
    expect(sortHref(Q, "changed")).toBe("/policies?sort=changed");
  });

  it("a sort always starts again at page 1 and keeps the filters", () => {
    const href = sortHref({ ...Q, q: "x", status: "none", page: 4 }, "sick");
    expect(href).toBe("/policies?q=x&status=none&sort=sick");
  });

  it("clearing removes every filter but keeps the order and page size", () => {
    expect(
      clearedHref({ ...Q, q: "x", team: "t", type: "y", status: "none", sort: "sick", per: 50 }),
    ).toBe("/policies?sort=sick&per=50");
  });
});

describe("filterChips", () => {
  const names = { teams: { t1: "Marco Santos" }, types: { v1: "Vacation" } };
  it("has one removable chip per applied filter, each link dropping only that filter", () => {
    const query = {
      ...Q,
      q: "ana",
      team: "t1",
      type: "v1",
      status: "none" as const,
      sort: "sick" as const,
    };
    const chips = filterChips(query, names);
    expect(chips.map((c) => c.label)).toEqual([
      "Name: ana",
      "Team: Marco Santos",
      "Leave type: Vacation",
      "Status: No policy yet",
    ]);
    expect(chips[0]!.href).toBe("/policies?team=t1&type=v1&status=none&sort=sick");
    expect(chips[3]!.href).toBe("/policies?q=ana&team=t1&type=v1&sort=sick");
  });

  it("has no chips without filters, and says Unknown for a team that is not in the list", () => {
    expect(filterChips({ ...Q, sort: "sick" }, names)).toEqual([]);
    expect(filterChips({ ...Q, team: "gone" }, names)[0]!.label).toBe("Team: Unknown");
  });
});

describe("formatLastChange and policyStatus", () => {
  it("writes the day in the zone and who, or Never", () => {
    expect(
      formatLastChange({ at: "2026-10-20T01:41:00.000Z", by: "Hana Reyes" }, "Asia/Manila"),
    ).toBe("Oct 20, 2026 by Hana Reyes");
    expect(formatLastChange({ at: "2026-10-20T20:00:00.000Z", by: "Hana" }, "Asia/Manila")).toBe(
      "Oct 21, 2026 by Hana",
    );
    expect(formatLastChange(null, "UTC")).toBe("Never");
  });

  it("is 'none' when any shown rate is missing and 'ok' otherwise", () => {
    expect(policyStatus([{ rate: "1.00" }, { rate: "0.00" }])).toBe("ok");
    expect(policyStatus([{ rate: "1.00" }, { rate: null }])).toBe("none");
    expect(policyStatus([])).toBe("ok");
  });
});
