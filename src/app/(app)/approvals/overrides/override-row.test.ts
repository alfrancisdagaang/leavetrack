import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { OverrideQueueRow } from "@/lib/leave/override-queue";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const { OverrideRow } = await import("./override-row");

const base: OverrideQueueRow = {
  id: "r1",
  employee_name: "Elena Cruz",
  manager_name: "Marco Santos",
  leave_type_name: "Vacation",
  start_date: "2026-11-02",
  end_date: "2026-11-06",
  reason: "Family trip",
  created_at: new Date("2026-10-18T00:00:00Z"),
  working_days: 5,
  balance: "2.00",
  shortfall: "3.00",
};

const row = (over: Partial<OverrideQueueRow> = {}) =>
  renderToStaticMarkup(createElement(OverrideRow, { request: { ...base, ...over } }));

describe("OverrideRow", () => {
  it("AC2: writes out the shortfall, the balance and what approving does, in text", () => {
    const out = row();
    expect(out).toContain("Elena Cruz");
    expect(out).toContain("2026-11-02 to 2026-11-06");
    expect(out).toContain("5 working days");
    expect(out).toContain("Over balance by 3 days");
    expect(out).toContain("Vacation balance is 2 days.");
    expect(out).toContain(
      "Approving uses all of their 2 days of Vacation and records a shortfall of 3 days",
    );
    expect(out).toContain("Pending");
  });

  it("AC2: offers Approve override and Reject, and the employee's reason and manager", () => {
    const out = row();
    expect(out).toContain(">Approve override<");
    expect(out).toContain(">Reject<");
    expect(out).toContain("Reason: Family trip");
    expect(out).toContain("Manager: Marco Santos");
  });

  it("a balance of 0 says it stays 0, not 'uses all of their 0 days'", () => {
    const out = row({ balance: "0.00", shortfall: "3.00" });
    expect(out).toContain(
      "Approving keeps their Vacation balance at 0 and records a shortfall of 3 days",
    );
    expect(out).not.toContain("uses all of their 0");
  });

  it("says so for an employee with no manager, and omits an empty reason", () => {
    const out = row({ manager_name: null, reason: "" });
    expect(out).toContain("Manager: No manager");
    expect(out).not.toContain("Reason:");
  });

  it("writes fractions and singular days as people say them", () => {
    const out = row({ balance: "0.50", shortfall: "1.00", working_days: 1 });
    expect(out).toContain("Over balance by 1 day");
    expect(out).not.toContain("1 days");
    expect(out).toContain("balance is 0.5 days");
    expect(out).toContain("1 working day");
  });

  it("AC5: nothing forces a horizontal scroll (long text wraps) and no colour is hard-coded", () => {
    const out = row({ reason: "x".repeat(300) });
    expect(out).toContain("break-words");
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(/);
    expect(out).not.toContain("whitespace-nowrap");
  });
});
