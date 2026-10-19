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
  balanceCheck: { kind: "ok" },
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
  overridden: false,
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

  it("AC1: an in-balance request has both Approve and Reject, and no balance note", () => {
    const out = row();
    expect(out).toContain(">Approve<");
    expect(out).toContain(">Reject<");
    expect(out).not.toContain("Waiting for HR override");
    expect(out).not.toContain("Over balance");
  });

  it("AC1: an over-balance request says how far over and that it waits for HR, with Reject only", () => {
    const out = row({ balanceCheck: { kind: "over", balance: 1, shortfall: 2 }, balance: 1 });
    expect(out).toContain("Over balance by 2 days");
    expect(out).toContain("Waiting for HR override");
    expect(out).toContain("balance is 1 day");
    expect(out).toContain(">Reject<");
    // No Approve at all (not a disabled one), and nothing offers to approve it.
    expect(out).not.toContain(">Approve<");
    expect(out).not.toContain("not available yet");
  });

  it("no balance record: says so, asks HR to set it up, Reject only (HR cannot override it either)", () => {
    const out = row({ balanceCheck: { kind: "no_balance_record" }, balance: null });
    expect(out).toContain("No balance record");
    expect(out).toContain("Ask HR to set it up");
    expect(out).not.toContain("Waiting for HR override");
    expect(out).not.toContain(">Approve<");
    expect(out).toContain(">Reject<");
  });

  it("a negative balance: says so, Reject only, no override promised", () => {
    const out = row({ balanceCheck: { kind: "negative", balance: -2 }, balance: -2 });
    expect(out).toContain("Balance is negative");
    expect(out).toContain("−2 days");
    expect(out).not.toContain("Waiting for HR override");
    expect(out).not.toContain(">Approve<");
  });

  it("AC4: a long unbroken word in the reason wraps instead of forcing a horizontal scroll at 375 px", () => {
    const out = row({ reason: "Supercalifragilisticexpialidocious".repeat(2) });
    const reasonParagraph = out.match(/<p class="[^"]*">Reason: [^<]*<\/p>/)?.[0] ?? "";
    expect(reasonParagraph).toContain("break-words");
    // The grid cell that holds it may shrink below the word's width.
    expect(out).toMatch(/<div class="min-w-0 space-y-1"><span[^>]*>Pending/);
  });

  it("AC4: the balance note is written text, with no colour hard-coded", () => {
    const out = row({ balanceCheck: { kind: "over", balance: 1, shortfall: 2 } });
    expect(out).not.toMatch(/#[0-9a-f]{3,6}|rgb\(/i);
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

  it("AC3: an approval HR made as an override reads Approved (HR override); an ordinary one does not", () => {
    expect(drow({ status: "approved", decision_note: null, overridden: true })).toContain(
      "Approved (HR override)",
    );
    expect(drow({ status: "approved", decision_note: null })).not.toContain("HR override");
  });

  it("approved shows no note and never a reason", () => {
    const out = drow({ status: "approved", decision_note: null });
    expect(out).toContain("Approved");
    expect(out).not.toContain("Rejection note");
    expect(out).not.toContain("Reason:");
  });
});
