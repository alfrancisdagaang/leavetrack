import { describe, expect, it } from "vitest";
import type { BalanceSummaryItem } from "@/lib/leave/balance";
import { summaryCards, welcomeSubtitle } from "@/lib/leave/dashboard";

const item = (over: Partial<BalanceSummaryItem>): BalanceSummaryItem => ({
  leaveTypeId: "10000000-0000-4000-8000-000000000001",
  leaveTypeName: "Vacation",
  tracksBalance: true,
  confirmed: 12,
  pending: 3,
  available: 9,
  ...over,
});

const BALANCES = [
  item({}),
  item({ leaveTypeName: "Sick", confirmed: 6, pending: 1, available: 5 }),
  item({
    leaveTypeName: "Unpaid",
    tracksBalance: false,
    confirmed: null,
    pending: 0,
    available: null,
  }),
];

describe("summaryCards", () => {
  it("shows confirmed balance and pending days for Vacation and Sick", () => {
    const [vacation, sick] = summaryCards({
      role: "employee",
      balances: BALANCES,
      pendingApprovals: null,
    });
    expect(vacation).toMatchObject({ key: "vacation", kind: "balance", amount: 12, unit: "days" });
    expect(vacation?.lines).toEqual(["Confirmed balance", "3 days pending approval"]);
    expect(sick?.lines).toEqual(["Confirmed balance", "1 day pending approval"]);
  });

  it("shows Unpaid as untracked, with no number", () => {
    const unpaid = summaryCards({
      role: "employee",
      balances: BALANCES,
      pendingApprovals: null,
    })[2];
    expect(unpaid).toMatchObject({ kind: "untracked", amount: null, headline: "Untracked" });
  });

  it("gives employees three cards and no pending-approvals card", () => {
    const keys = summaryCards({ role: "employee", balances: BALANCES, pendingApprovals: 4 }).map(
      (c) => c.key,
    );
    expect(keys).toEqual(["vacation", "sick", "unpaid"]);
  });

  const OUT = {
    days: [
      { day: "2026-10-21", total: 5, pending: 2 },
      { day: "2026-10-22", total: 3, pending: 0 },
    ],
    weekPeople: 7,
    pendingTotal: 4,
  };
  const TODAY = "2026-10-21"; // a Wednesday

  it("gives managers three cards: approvals, out today and out in the next 7 days, no balances", () => {
    const cards = summaryCards({
      role: "manager",
      balances: BALANCES,
      pendingApprovals: 3,
      out: OUT,
      today: TODAY,
    });
    expect(cards.map((c) => c.key)).toEqual(["approvals", "out-today", "out-week"]);
    expect(cards[0]).toMatchObject({ kind: "count", amount: 3, unit: "requests" });
    expect(cards[1]).toMatchObject({
      title: "Out today",
      amount: 5,
      unit: "people",
      lines: ["On your team.", "2 still pending."],
    });
    expect(cards[2]).toMatchObject({
      title: "Out in the next 7 days",
      amount: 7,
      unit: "people",
      lines: ["On your team,", "through Tue 27 Oct 2026."],
    });
    const one = summaryCards({ role: "manager", balances: null, pendingApprovals: 1 })[0];
    expect(one).toMatchObject({ amount: 1, unit: "request" });
  });

  it("gives HR three cards: overrides, out today and pending requests, never approvals or balances", () => {
    const cards = summaryCards({
      role: "hr_admin",
      balances: BALANCES,
      pendingApprovals: 5,
      overrides: 2,
      out: OUT,
      today: TODAY,
    });
    expect(cards.map((c) => c.key)).toEqual(["overrides", "out-today", "pending-all"]);
    expect(cards[0]).toMatchObject({
      title: "Awaiting HR override",
      kind: "count",
      amount: 2,
      unit: "requests",
    });
    expect(cards[1]).toMatchObject({
      amount: 5,
      unit: "people",
      lines: ["Across the company.", "2 still pending."],
    });
    expect(cards[2]).toMatchObject({ title: "Pending requests", amount: 4, unit: "requests" });
    expect(
      summaryCards({ role: "hr_admin", balances: null, pendingApprovals: null, overrides: 1 })[0],
    ).toMatchObject({ amount: 1, unit: "request" });
  });

  it("says Out today is Weekend, with no number, on a Saturday or Sunday", () => {
    for (const today of ["2026-10-24", "2026-10-25"]) {
      const card = summaryCards({
        role: "hr_admin",
        balances: null,
        pendingApprovals: null,
        overrides: 0,
        out: OUT,
        today,
      })[1];
      expect(card).toMatchObject({ headline: "Weekend", amount: null });
    }
  });

  it("says nobody is out, and 1 person singular, in plain words", () => {
    const none = summaryCards({
      role: "manager",
      balances: null,
      pendingApprovals: 0,
      out: { days: [{ day: TODAY, total: 0, pending: 0 }], weekPeople: 0, pendingTotal: 0 },
      today: TODAY,
    });
    expect(none[1]).toMatchObject({ amount: 0, lines: ["Nobody is out on your team."] });
    const one = summaryCards({
      role: "manager",
      balances: null,
      pendingApprovals: 0,
      out: { days: [{ day: TODAY, total: 1, pending: 0 }], weekPeople: 1, pendingTotal: 0 },
      today: TODAY,
    });
    expect(one[1]).toMatchObject({
      amount: 1,
      unit: "person",
      lines: ["On your team.", "None pending."],
    });
    expect(one[2]).toMatchObject({ amount: 1, unit: "person" });
  });

  it("says so when balances or the figures are unavailable instead of inventing numbers", () => {
    const manager = summaryCards({ role: "manager", balances: null, pendingApprovals: null });
    expect(manager.map((c) => c.kind)).toEqual(["unavailable", "unavailable", "unavailable"]);
    const hr = summaryCards({ role: "hr_admin", balances: null, pendingApprovals: null });
    expect(hr.map((c) => c.kind)).toEqual(["unavailable", "unavailable", "unavailable"]);
    expect([...manager, ...hr].every((c) => c.amount === null)).toBe(true);
  });

  it("shows zero days pending in plain words", () => {
    const [vacation] = summaryCards({
      role: "employee",
      balances: [item({ pending: 0 })],
      pendingApprovals: null,
    });
    expect(vacation?.lines[1]).toBe("No days pending approval");
  });
});

describe("welcomeSubtitle", () => {
  it("keeps employees to their own leave", () => {
    expect(welcomeSubtitle("employee", 5)).toBe("Your leave balance and requests, at a glance.");
  });

  it("tells managers how many approvals are waiting", () => {
    expect(welcomeSubtitle("manager", 3)).toBe(
      "Your team's leave and approvals, at a glance. You have 3 approvals to review.",
    );
    expect(welcomeSubtitle("manager", 1)).toContain("You have 1 approval to review.");
  });

  it("tells HR admins about overrides, never about approvals or a team", () => {
    expect(welcomeSubtitle("hr_admin", null)).toBe(
      "Company leave, overrides and the audit record, at a glance.",
    );
    expect(welcomeSubtitle("hr_admin", 0)).toContain("No overrides are waiting.");
    expect(welcomeSubtitle("hr_admin", 1)).toContain("1 request waits for an override.");
    expect(welcomeSubtitle("hr_admin", 4)).toContain("4 requests wait for an override.");
    expect(welcomeSubtitle("hr_admin", 4)).not.toContain("approval");
  });

  it("handles none waiting and an unavailable count", () => {
    expect(welcomeSubtitle("manager", 0)).toContain("No approvals are waiting.");
    expect(welcomeSubtitle("manager", null)).toBe("Your team's leave and approvals, at a glance.");
  });
});
