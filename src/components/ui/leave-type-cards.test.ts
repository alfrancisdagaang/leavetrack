import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LeaveTypeCards } from "@/components/ui/leave-type-cards";
import type { BalanceSummaryItem } from "@/lib/leave/balance";

const VAC: BalanceSummaryItem = {
  leaveTypeId: "vac",
  leaveTypeName: "Vacation",
  tracksBalance: true,
  confirmed: 12,
  pending: 2,
  available: 10,
};
const SICK: BalanceSummaryItem = {
  leaveTypeId: "sick",
  leaveTypeName: "Sick",
  tracksBalance: true,
  confirmed: 8,
  pending: 2,
  available: 6,
};
const UNPAID: BalanceSummaryItem = {
  leaveTypeId: "unp",
  leaveTypeName: "Unpaid",
  tracksBalance: false,
  confirmed: null,
  pending: 0,
  available: null,
};

const render = (balances: BalanceSummaryItem[], value = "vac", disabled = false) =>
  renderToStaticMarkup(
    createElement(LeaveTypeCards, { balances, value, onChange: () => {}, disabled }),
  );

describe("LeaveTypeCards", () => {
  it("is a radio group: one native radio per type, named leave_type_id, with the value selected", () => {
    const out = render([VAC, SICK, UNPAID], "sick");
    expect(out).toContain("<fieldset");
    expect(out).toContain("<legend");
    expect(out.match(/type="radio"/g)).toHaveLength(3);
    expect(out.match(/name="leave_type_id"/g)).toHaveLength(3);
    expect(out.match(/checked=""/g)).toHaveLength(1);
    expect(out).toMatch(/value="sick"[^>]*checked=""|checked=""[^>]*value="sick"/);
  });

  it("shows what is available and pending on each tracked card", () => {
    const out = render([VAC, SICK, UNPAID]);
    expect(out).toContain(">10<");
    expect(out).toContain(">6<");
    expect(out.match(/days available/g)).toHaveLength(2);
    expect(out.match(/2 pending/g)).toHaveLength(2);
  });

  it("shows Unpaid as untracked with no balance limit", () => {
    const out = render([UNPAID]);
    expect(out).toContain("Untracked");
    expect(out).toContain("No balance limit");
    expect(out).not.toContain("pending");
  });

  it("uses the dashboard icons for the three types", () => {
    const out = render([VAC, SICK, UNPAID]);
    for (const icon of ["sun.svg", "heart-pulse.svg", "calendar-minus.svg"]) {
      expect(out).toContain(icon);
    }
  });

  it("shows a zero balance as 0 in the warning colour, and clamps a negative one to 0", () => {
    const zero = { ...VAC, available: 0, confirmed: 2 };
    const negative = { ...VAC, available: -3, confirmed: 0, pending: 3 };
    for (const item of [zero, negative]) {
      const out = render([item]);
      expect(out).toContain(">0<");
      expect(out).toContain("text-warn-fg");
      expect(out).not.toContain(">-3<");
    }
  });

  it("uses the singular for one day", () => {
    expect(render([{ ...VAC, available: 1 }])).toContain("day available");
    expect(render([{ ...VAC, available: 1 }])).not.toContain("days available");
  });

  it("has the check badge, ring and keyboard focus ring driven by the radio state", () => {
    const out = render([VAC]);
    expect(out).toContain("check-white.svg");
    expect(out).toContain("peer-checked:flex");
    expect(out).toContain("peer-checked:ring-brand-500");
    expect(out).toContain("peer-focus-visible:ring-2");
  });

  it("can be disabled as a whole (after submit and while submitting)", () => {
    expect(render([VAC], "vac", true)).toMatch(/<fieldset[^>]*disabled/);
    expect(render([VAC], "vac", false)).not.toMatch(/<fieldset[^>]*disabled/);
  });
});
