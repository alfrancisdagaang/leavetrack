import { describe, expect, it } from "vitest";
import type { AuditListQuery } from "@/lib/leave/schemas";
import { auditHref, filterChips, filtersHref } from "./audit-url";

const T = "10000000-0000-4000-8000-000000000001";
const U = "00000000-0000-4000-8000-000000000002";
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
  leaveTypes: [{ id: T, name: "Vacation" }],
  deciders: [{ id: U, name: "Marco Santos" }],
};

describe("auditHref", () => {
  it("is the plain address when nothing is set", () => {
    expect(auditHref(NONE)).toBe("/audit");
  });

  it("writes only the values that are set, and the page when it is not the first", () => {
    expect(auditHref({ ...NONE, q: "el ena", status: "deleted" }, 3)).toBe(
      "/audit?q=el+ena&status=deleted&page=3",
    );
  });
});

describe("filtersHref", () => {
  it("builds the address for the form values, always at page 1", () => {
    expect(
      filtersHref({
        q: " elena ",
        type: T,
        status: "pending",
        by: U,
        from: "2026-01-01",
        to: "2026-02-01",
      }),
    ).toBe(`/audit?q=elena&type=${T}&status=pending&by=${U}&from=2026-01-01&to=2026-02-01`);
  });

  it("drops odd values instead of trusting them", () => {
    expect(filtersHref({ q: "", type: "", status: "cancelled", by: "", from: "x", to: "" })).toBe(
      "/audit",
    );
  });
});

describe("filterChips", () => {
  it("is empty with no filters", () => {
    expect(filterChips(NONE, choices)).toEqual([]);
  });

  it("has one chip per applied filter, and each removes only its own filter", () => {
    const query: AuditListQuery = {
      q: "elena",
      leaveTypeId: T,
      status: "deleted",
      decidedBy: U,
      from: "2026-01-01",
      to: "2026-02-01",
      page: 4,
    };
    const chips = filterChips(query, choices);
    expect(chips.map((c) => c.label)).toEqual([
      "Search: elena",
      "Leave type: Vacation",
      "Status: Removed (soft-deleted)",
      "Decided by: Marco Santos",
      "From: Jan 1, 2026",
      "To: Feb 1, 2026",
    ]);
    const status = chips.find((c) => c.key === "status")!;
    expect(status.removeHref).toBe(
      `/audit?q=elena&type=${T}&by=${U}&from=2026-01-01&to=2026-02-01`,
    );
    expect(status.removeHref).not.toContain("page=");
  });
});
