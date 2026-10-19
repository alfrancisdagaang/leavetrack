import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BalanceSummaryItem } from "@/lib/leave/balance";
import type * as OutFiguresModule from "@/lib/leave/out-figures";

const outf = vi.hoisted(() => ({ getOutFigures: vi.fn() }));
const svc = vi.hoisted(() => ({ getDashboardSummary: vi.fn() }));
const ovr = vi.hoisted(() => ({ getOverrideCount: vi.fn() }));
const cal = vi.hoisted(() => ({ getCalendarRequests: vi.fn() }));
const upc = vi.hoisted(() => ({ getUpcomingLeave: vi.fn() }));
const act = vi.hoisted(() => ({ getRecentActivity: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {} }),
  unstable_rethrow: () => {},
}));
vi.mock("@/lib/leave/service", () => ({
  requireDb: () => ({}),
  getDashboardSummary: svc.getDashboardSummary,
}));
vi.mock("@/lib/leave/out-figures", async (importOriginal) => ({
  ...(await importOriginal<typeof OutFiguresModule>()),
  getOutFigures: outf.getOutFigures,
}));
vi.mock("@/lib/leave/override-queue", () => ({ getOverrideCount: ovr.getOverrideCount }));
vi.mock("@/lib/leave/calendar", () => ({ getCalendarRequests: cal.getCalendarRequests }));
vi.mock("@/lib/leave/upcoming", () => ({ getUpcomingLeave: upc.getUpcomingLeave }));
vi.mock("@/lib/leave/activity", () => ({ getRecentActivity: act.getRecentActivity }));

const { ActivitySection, CalendarSection, SummarySection, UpcomingSection } =
  await import("./sections");

const BALANCES: BalanceSummaryItem[] = [
  {
    leaveTypeId: "t1",
    leaveTypeName: "Vacation",
    tracksBalance: true,
    confirmed: 12,
    pending: 0,
    available: 12,
  },
];
const html = async (element: Promise<ReactElement>) => renderToStaticMarkup(await element);

beforeEach(() => {
  vi.clearAllMocks();
});

const TODAY = "2026-10-21"; // a Wednesday
const FIGURES = {
  days: [
    { day: "2026-10-21", total: 5, pending: 2 },
    { day: "2026-10-22", total: 3, pending: 0 },
    { day: "2026-10-23", total: 0, pending: 0 },
  ],
  weekPeople: 7,
  pendingTotal: 4,
};

describe("SummarySection", () => {
  it("shows every employee card as unavailable when the one summary read fails", async () => {
    svc.getDashboardSummary.mockRejectedValue(new Error("boom"));
    const employee = await html(SummarySection({ role: "employee", userId: "u1", today: TODAY }));
    expect(employee.match(/Not available right now\./g)).toHaveLength(3);
    expect(outf.getOutFigures).not.toHaveBeenCalled();
  });

  it("does not ask for the approvals count for an employee, and gives no out figures", async () => {
    svc.getDashboardSummary.mockResolvedValue({ balances: BALANCES, pendingApprovals: null });
    const out = await html(SummarySection({ role: "employee", userId: "u1", today: TODAY }));
    expect(svc.getDashboardSummary).toHaveBeenCalledWith({}, "u1", false);
    expect(out).not.toContain("Pending approvals");
    expect(out).not.toContain("Out today");
  });

  it("gives a manager three cards from ONE read, scoped to the team by the session id", async () => {
    outf.getOutFigures.mockResolvedValue(FIGURES);
    const out = await html(SummarySection({ role: "manager", userId: "m1", today: TODAY }));
    expect(outf.getOutFigures).toHaveBeenCalledTimes(1);
    expect(outf.getOutFigures).toHaveBeenCalledWith(
      {},
      { viewerId: "m1", scope: "team", today: TODAY },
    );
    expect(svc.getDashboardSummary).not.toHaveBeenCalled();
    expect(ovr.getOverrideCount).not.toHaveBeenCalled();
    expect(out).toContain("Pending approvals");
    expect(out).toContain("Out today");
    expect(out).toContain("Out in the next 7 days");
    expect(out).toContain("On your team");
    // A manager has no balance cards (EPIC-10) and no HR strip.
    expect(out).not.toContain("Vacation");
    expect(out).not.toContain("Next 7 days</h2>");
  });

  it("says all three manager cards are unavailable when the one read fails", async () => {
    outf.getOutFigures.mockRejectedValue(new Error("boom"));
    const out = await html(SummarySection({ role: "manager", userId: "m1", today: TODAY }));
    expect(out.match(/Not available right now\./g)).toHaveLength(3);
  });

  it("gives HR three cards and the Next 7 days strip, with two reads and no balance read (EPIC-10)", async () => {
    ovr.getOverrideCount.mockResolvedValue(3);
    outf.getOutFigures.mockResolvedValue(FIGURES);
    const out = await html(SummarySection({ role: "hr_admin", userId: "h1", today: TODAY }));
    expect(ovr.getOverrideCount).toHaveBeenCalledWith({}, "h1");
    expect(outf.getOutFigures).toHaveBeenCalledWith(
      {},
      { viewerId: "h1", scope: "company", today: TODAY },
    );
    expect(svc.getDashboardSummary).not.toHaveBeenCalled();
    expect(out).toContain("Awaiting HR override");
    expect(out).toContain("Out today");
    expect(out).toContain("Pending requests");
    expect(out).not.toContain("Pending approvals");
    expect(out).toContain("Next 7 days");
    expect(out).toContain('href="/calendar?month=2026-10&amp;day=2026-10-21"');
    expect(out).toContain('href="/calendar"');
  });

  it("says the override card is unavailable when its read fails, and keeps the other cards", async () => {
    ovr.getOverrideCount.mockRejectedValue(new Error("boom"));
    outf.getOutFigures.mockResolvedValue(FIGURES);
    const out = await html(SummarySection({ role: "hr_admin", userId: "h1", today: TODAY }));
    expect(out.match(/Not available right now\./g)).toHaveLength(1);
    expect(out).toContain("Awaiting HR override");
    expect(out).toContain("Next 7 days");
  });

  it("says the out cards are unavailable and drops the strip when the out read fails", async () => {
    ovr.getOverrideCount.mockResolvedValue(0);
    outf.getOutFigures.mockRejectedValue(new Error("boom"));
    const out = await html(SummarySection({ role: "hr_admin", userId: "h1", today: TODAY }));
    expect(out.match(/Not available right now\./g)).toHaveLength(2);
    expect(out).not.toContain("Next 7 days</h2>");
  });

  it("writes Weekend, not a number, for Out today on a Saturday", async () => {
    outf.getOutFigures.mockResolvedValue({ ...FIGURES, days: FIGURES.days.slice(1) });
    const out = await html(SummarySection({ role: "manager", userId: "m1", today: "2026-10-24" }));
    expect(out).toContain("Weekend");
  });
});

describe("CalendarSection", () => {
  const props = {
    role: "employee" as const,
    viewerId: "u1",
    month: { year: 2026, month: 10 },
    today: "2026-10-17" as const,
    showRejected: false,
  };

  it("says the calendar is unavailable when its read fails, instead of throwing", async () => {
    cal.getCalendarRequests.mockRejectedValue(new Error("boom"));
    const out = await html(CalendarSection(props));
    expect(out).toContain("The calendar is not available right now");
  });

  it("queries with the viewer's own id and role, never a client-supplied one", async () => {
    cal.getCalendarRequests.mockResolvedValue([]);
    await html(CalendarSection(props));
    expect(cal.getCalendarRequests).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ role: "employee", userId: "u1", includeRejected: false }),
    );
  });
});

describe("UpcomingSection (US-11)", () => {
  const props = { role: "manager" as const, viewerId: "m1", today: "2026-10-15" as const };

  it("AC7: says upcoming leave is unavailable when its read fails, instead of throwing", async () => {
    upc.getUpcomingLeave.mockRejectedValue(new Error("boom"));
    const out = await html(UpcomingSection(props));
    expect(out).toContain("Upcoming leave is not available right now");
  });

  it("queries with the viewer's own id and role and the server's today, never a client-supplied one", async () => {
    upc.getUpcomingLeave.mockResolvedValue([]);
    await html(UpcomingSection(props));
    expect(upc.getUpcomingLeave).toHaveBeenCalledWith(
      {},
      { role: "manager", userId: "m1", today: "2026-10-15" },
    );
  });

  it("AC1: renders the rows the query returned", async () => {
    upc.getUpcomingLeave.mockResolvedValue([
      {
        id: "r1",
        userId: "p1",
        userName: "Priya Shah",
        leaveTypeName: "Vacation",
        startDate: "2026-10-19",
        endDate: "2026-10-21",
        status: "pending",
      },
    ]);
    const out = await html(UpcomingSection(props));
    expect(out).toContain("Priya Shah");
    expect(out).toContain("Oct 19–21 · Vacation");
  });
});

describe("ActivitySection (US-11)", () => {
  const props = { role: "employee" as const, viewerId: "u1", timeZone: "Asia/Manila" };

  it("AC7: says recent activity is unavailable when its read fails, instead of throwing", async () => {
    act.getRecentActivity.mockRejectedValue(new Error("boom"));
    const out = await html(ActivitySection(props));
    expect(out).toContain("Recent activity is not available right now");
  });

  it("queries with the viewer's own id and role, never a client-supplied one", async () => {
    act.getRecentActivity.mockResolvedValue([]);
    await html(ActivitySection(props));
    expect(act.getRecentActivity).toHaveBeenCalledWith({}, { role: "employee", userId: "u1" });
  });

  it("AC5: renders the events the query returned", async () => {
    act.getRecentActivity.mockResolvedValue([
      {
        id: "e1",
        action: "submitted",
        occurredAt: "2026-10-15T01:42:00.000Z",
        actorId: "u1",
        actorName: "Elena Cruz",
        ownerId: "u1",
        ownerName: "Elena Cruz",
        leaveTypeName: "Vacation",
        startDate: "2026-10-21",
        endDate: "2026-10-23",
      },
    ]);
    const out = await html(ActivitySection(props));
    expect(out).toContain("Elena Cruz submitted Vacation · Oct 21–23");
  });
});
