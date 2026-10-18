import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DecidedTeamRequestView, TeamRequestView } from "@/lib/leave/team";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const { ApprovalRow } = await import("./approval-row");
const { DecidedRow } = await import("./decided-row");

const pending: TeamRequestView = {
  id: "r1",
  employee_name: "Elena Rossi",
  leave_type_id: "t1",
  leave_type_name: "Vacation",
  tracks_balance: true,
  start_date: "2026-11-02",
  end_date: "2026-11-04",
  reason: "Family trip",
  status: "pending",
  created_at: new Date("2026-10-18T00:00:00Z"),
  working_days: 3,
  balance: 10,
  insufficient: false,
};
const decided: DecidedTeamRequestView = {
  id: "r2",
  employee_name: "Elena Rossi",
  leave_type_name: "Sick",
  start_date: "2026-10-01",
  end_date: "2026-10-01",
  status: "rejected",
  decision_note: "Team is short that week",
  decided_at: new Date("2026-10-02T00:00:00Z"),
  working_days: 1,
};

const row = (r: Partial<TeamRequestView> = {}) =>
  renderToStaticMarkup(createElement(ApprovalRow, { request: { ...pending, ...r } }));
const drow = (r: Partial<DecidedTeamRequestView> = {}) =>
  renderToStaticMarkup(createElement(DecidedRow, { request: { ...decided, ...r } }));

describe("ApprovalRow", () => {
  it("shows the person, type, dates, working days, a written Pending status and the reason", () => {
    const out = row();
    for (const t of [
      "Elena Rossi",
      "Vacation",
      "2026-11-02 to 2026-11-04",
      "3 working days",
      "Pending",
      "Reason: Family trip",
    ])
      expect(out).toContain(t);
    expect(out).toContain("ER");
  });

  it("has the Approve and Reject controls", () => {
    const out = row();
    expect(out).toContain("Approve");
    expect(out).toContain("Reject");
  });

  it("insufficient balance: warns, and disables Approve", () => {
    const out = row({ insufficient: true, balance: 1 });
    expect(out).toContain("Cannot be approved");
    expect(out).toContain("Vacation balance is 1 day.");
    expect(out).toMatch(/<button(?=[^>]*disabled)[^>]*>\s*Approve/);
  });

  it("no balance record: says so", () => {
    expect(row({ insufficient: true, balance: null })).toContain("no balance record");
  });

  it("omits the reason when there is none, and is a card row with tokens only", () => {
    const out = row({ reason: "" });
    expect(out).not.toContain("Reason:");
    expect(out).toContain("<li");
    expect(out).not.toContain("max-w-5xl");
    expect(out).not.toMatch(/#[0-9a-f]{3,6}|rgb\(/i);
  });
});

describe("DecidedRow", () => {
  it("shows the status in words and the rejection note, and no actions", () => {
    const out = drow();
    expect(out).toContain("Rejected");
    expect(out).toContain("Rejection note: Team is short that week");
    expect(out).not.toContain("Approve");
  });

  it("approved shows no note and never a reason", () => {
    const out = drow({ status: "approved", decision_note: null });
    expect(out).toContain("Approved");
    expect(out).not.toContain("Rejection note");
    expect(out).not.toContain("Reason:");
  });
});
