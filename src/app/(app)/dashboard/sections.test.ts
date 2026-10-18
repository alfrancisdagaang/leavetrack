import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BalanceSummaryItem } from "@/lib/leave/balance";

const svc = vi.hoisted(() => ({ getDashboardSummary: vi.fn() }));
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

describe("SummarySection", () => {
  it("shows every card as unavailable when the one summary read fails", async () => {
    svc.getDashboardSummary.mockRejectedValue(new Error("boom"));
    const employee = await html(SummarySection({ role: "employee", userId: "u1" }));
    expect(employee.match(/Not available right now\./g)).toHaveLength(3);

    const manager = await html(SummarySection({ role: "manager", userId: "m1" }));
    expect(manager.match(/Not available right now\./g)).toHaveLength(4);
    expect(manager).toContain("Pending approvals");
  });

  it("reads balances and the pending count in one call, scoped by the given id", async () => {
    svc.getDashboardSummary.mockResolvedValue({ balances: BALANCES, pendingApprovals: 2 });
    const out = await html(SummarySection({ role: "manager", userId: "m1" }));
    expect(svc.getDashboardSummary).toHaveBeenCalledTimes(1);
    expect(svc.getDashboardSummary).toHaveBeenCalledWith({}, "m1", true);
    expect(out).toContain("Pending approvals");
    expect(out).toContain("12");
    expect(out).toContain("2");
  });

  it("does not ask for the approvals count for an employee", async () => {
    svc.getDashboardSummary.mockResolvedValue({ balances: BALANCES, pendingApprovals: null });
    const out = await html(SummarySection({ role: "employee", userId: "u1" }));
    expect(svc.getDashboardSummary).toHaveBeenCalledWith({}, "u1", false);
    expect(out).not.toContain("Pending approvals");
  });

  it("asks for the approvals count for HR as well", async () => {
    svc.getDashboardSummary.mockResolvedValue({ balances: BALANCES, pendingApprovals: 0 });
    const out = await html(SummarySection({ role: "hr_admin", userId: "h1" }));
    expect(svc.getDashboardSummary).toHaveBeenCalledWith({}, "h1", true);
    expect(out).toContain("Nothing is waiting");
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
