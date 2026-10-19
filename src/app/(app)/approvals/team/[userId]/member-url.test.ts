import { describe, expect, it } from "vitest";
import { filterChips, filtersHref, memberHref } from "./member-url";

const ID = "00000000-0000-4000-8000-000000000003";
const VAC = "10000000-0000-4000-8000-000000000001";
const ALL = { leaveTypeId: undefined, status: undefined, year: 2026, page: 1 } as const;

describe("memberHref", () => {
  it("is the plain address when every filter is at its default", () => {
    expect(memberHref(ID, ALL, 2026)).toBe(`/approvals/team/${ID}`);
  });

  it("writes only what differs from the defaults, and keeps the filters across pages (US-13 AC2, AC6)", () => {
    expect(memberHref(ID, { ...ALL, leaveTypeId: VAC, status: "pending", year: 2025 }, 2026)).toBe(
      `/approvals/team/${ID}?type=${VAC}&status=pending&year=2025`,
    );
    expect(memberHref(ID, { ...ALL, status: "approved" }, 2026, 3)).toBe(
      `/approvals/team/${ID}?status=approved&page=3`,
    );
  });

  it("never writes page 1", () => {
    expect(memberHref(ID, ALL, 2026, 1)).toBe(`/approvals/team/${ID}`);
  });
});

describe("popup addresses (My Team popup, ?member=<id>)", () => {
  it("memberHref opens the popup on the My Team page and keeps the filters and the page", () => {
    expect(memberHref(ID, ALL, 2026, 1, true)).toBe(`/approvals/team?member=${ID}`);
    expect(memberHref(ID, { ...ALL, status: "approved" }, 2026, 3, true)).toBe(
      `/approvals/team?member=${ID}&status=approved&page=3`,
    );
  });

  it("filtersHref and the filter chips keep the popup open", () => {
    expect(filtersHref(ID, { type: VAC, status: "pending", year: "2026" }, 2026, true)).toBe(
      `/approvals/team?member=${ID}&type=${VAC}&status=pending`,
    );
    const chips = filterChips(
      ID,
      { ...ALL, status: "pending" },
      [{ id: VAC, name: "Vacation" }],
      2026,
      true,
    );
    expect(chips.map((c) => c.removeHref)).toEqual([`/approvals/team?member=${ID}`]);
  });

  it("the default is still the member page", () => {
    expect(memberHref(ID, ALL, 2026)).toBe(`/approvals/team/${ID}`);
  });
});

describe("filtersHref (applying the form)", () => {
  const VALUES = { type: "", status: "", year: "2026" };

  it("is the plain address when everything is All and this year", () => {
    expect(filtersHref(ID, VALUES, 2026)).toBe(`/approvals/team/${ID}`);
  });

  it("writes the chosen type, status and year, and always starts at page 1", () => {
    expect(filtersHref(ID, { type: VAC, status: "pending", year: "2025" }, 2026)).toBe(
      `/approvals/team/${ID}?type=${VAC}&status=pending&year=2025`,
    );
  });

  it("ignores an odd status or year instead of passing it on (the server checks again anyway)", () => {
    expect(filtersHref(ID, { type: "", status: "deleted", year: "abc" }, 2026)).toBe(
      `/approvals/team/${ID}`,
    );
    expect(filtersHref(ID, { type: "", status: "", year: "" }, 2026)).toBe(`/approvals/team/${ID}`);
  });
});

describe("filterChips (the applied filters)", () => {
  const TYPES = [
    { id: VAC, name: "Vacation" },
    { id: "10000000-0000-4000-8000-000000000002", name: "Sick" },
  ];

  it("has no chips at the defaults", () => {
    expect(filterChips(ID, ALL, TYPES, 2026)).toEqual([]);
  });

  it("has a chip per applied filter, in the order type, status, year", () => {
    const chips = filterChips(
      ID,
      { leaveTypeId: VAC, status: "approved", year: 2025, page: 3 },
      TYPES,
      2026,
    );
    expect(chips.map((c) => [c.key, c.label])).toEqual([
      ["type", "Leave type: Vacation"],
      ["status", "Status: Approved"],
      ["year", "Year: 2025"],
    ]);
  });

  it("each chip's link removes only its own filter and goes back to page 1", () => {
    const chips = filterChips(
      ID,
      { leaveTypeId: VAC, status: "approved", year: 2025, page: 3 },
      TYPES,
      2026,
    );
    expect(chips.find((c) => c.key === "type")?.removeHref).toBe(
      `/approvals/team/${ID}?status=approved&year=2025`,
    );
    expect(chips.find((c) => c.key === "status")?.removeHref).toBe(
      `/approvals/team/${ID}?type=${VAC}&year=2025`,
    );
    expect(chips.find((c) => c.key === "year")?.removeHref).toBe(
      `/approvals/team/${ID}?type=${VAC}&status=approved`,
    );
  });

  it("does not make up a name for a leave type that is not in the list", () => {
    const chips = filterChips(
      ID,
      { ...ALL, leaveTypeId: "10000000-0000-4000-8000-0000000000ff" },
      TYPES,
      2026,
    );
    expect(chips[0]?.label).toBe("Leave type: Unknown");
  });
});
