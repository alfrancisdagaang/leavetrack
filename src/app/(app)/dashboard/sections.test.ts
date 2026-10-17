import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BalanceSummaryItem } from "@/lib/leave/balance";

const svc = vi.hoisted(() => ({ getBalanceSummary: vi.fn(), getTeamQueue: vi.fn() }));
const cal = vi.hoisted(() => ({ getCalendarRequests: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {} }),
  unstable_rethrow: () => {},
}));
vi.mock("@/lib/leave/service", () => ({
  requireDb: () => ({}),
  getBalanceSummary: svc.getBalanceSummary,
}));
vi.mock("@/lib/leave/team", () => ({ getTeamQueue: svc.getTeamQueue }));
vi.mock("@/lib/leave/calendar", () => ({ getCalendarRequests: cal.getCalendarRequests }));

const { CalendarSection, SummarySection } = await import("./sections");

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
  it("shows every balance card as unavailable when the balances read fails", async () => {
    svc.getBalanceSummary.mockRejectedValue(new Error("boom"));
    const out = await html(SummarySection({ role: "employee", userId: "u1" }));
    expect(out.match(/Not available right now\./g)).toHaveLength(3);
  });

  it("keeps the pending-approvals card when only the balances read fails", async () => {
    svc.getBalanceSummary.mockRejectedValue(new Error("boom"));
    svc.getTeamQueue.mockResolvedValue([{}, {}]);
    const out = await html(SummarySection({ role: "manager", userId: "m1" }));
    expect(out).toContain("Pending approvals");
    expect(out).toContain("2");
    expect(out.match(/Not available right now\./g)).toHaveLength(3);
  });

  it("does not query the team queue for an employee, and scopes balances by the given id", async () => {
    svc.getBalanceSummary.mockResolvedValue(BALANCES);
    await html(SummarySection({ role: "employee", userId: "u1" }));
    expect(svc.getTeamQueue).not.toHaveBeenCalled();
    expect(svc.getBalanceSummary).toHaveBeenCalledWith({}, "u1");
  });

  it("shows the pending card as unavailable when only the queue read fails", async () => {
    svc.getBalanceSummary.mockResolvedValue(BALANCES);
    svc.getTeamQueue.mockRejectedValue(new Error("boom"));
    const out = await html(SummarySection({ role: "hr_admin", userId: "h1" }));
    expect(out).toContain("12");
    expect(out.match(/Not available right now\./g)).toHaveLength(1);
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
