import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CalendarRequest } from "@/lib/leave/calendar-layout";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {} }) }));

const { LeaveCalendar } = await import("@/components/ui/leave-calendar");

const MARCO = "00000000-0000-4000-8000-000000000002";

const request = (over: Partial<CalendarRequest>): CalendarRequest => ({
  id: "r1",
  userId: MARCO,
  userName: "Marco Santos",
  leaveTypeName: "Vacation",
  startDate: "2026-10-01",
  endDate: "2026-10-03",
  status: "approved",
  ...over,
});

const REQUESTS = [
  request({}),
  request({
    id: "r2",
    userId: "p",
    userName: "Priya Shah",
    startDate: "2026-10-19",
    endDate: "2026-10-21",
    status: "pending",
  }),
  request({
    id: "r3",
    userId: "u",
    userName: "Ana Lopez",
    leaveTypeName: "Unpaid",
    startDate: "2026-10-29",
    endDate: "2026-10-30",
    status: "rejected",
  }),
];

function render(props: Partial<ComponentProps<typeof LeaveCalendar>> = {}) {
  return renderToStaticMarkup(
    createElement(LeaveCalendar, {
      role: "manager",
      viewerId: MARCO,
      month: { year: 2026, month: 10 },
      today: "2026-10-15",
      requests: REQUESTS,
      showRejected: false,
      ...props,
    }),
  );
}

describe("LeaveCalendar", () => {
  it("shows the month, today's date and a subtitle for the role", () => {
    const html = render();
    expect(html).toContain("Leave calendar");
    expect(html).toContain("October 2026");
    expect(html).toContain("You + your team");
    expect(html).toContain("Today is Thursday, October 15");
    expect(render({ role: "employee" })).toContain("Your leave");
    expect(render({ role: "hr_admin" })).toContain("Everyone");
  });

  it("highlights today with aria-current=date on exactly one cell", () => {
    const html = render();
    expect(html.match(/aria-current="date"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="date"[^>]*>15</);
  });

  it("links previous, next and Today, keeping the rejected switch in the URL", () => {
    const html = render();
    expect(html).toMatch(
      /href="\/dashboard\?month=2026-09"[^>]*aria-label="Previous month"|aria-label="Previous month"[^>]*href="\/dashboard\?month=2026-09"/,
    );
    expect(html).toContain('href="/dashboard?month=2026-11"');
    expect(html).toContain('href="/dashboard"');
    const on = render({ showRejected: true });
    expect(on).toContain('href="/dashboard?month=2026-09&amp;rejected=1"');
    expect(on).toContain('href="/dashboard?rejected=1"');
  });

  it("rolls the links over a year boundary", () => {
    const html = render({ month: { year: 2026, month: 12 }, requests: [] });
    expect(html).toContain('href="/dashboard?month=2027-01"');
    expect(html).toContain('href="/dashboard?month=2026-11"');
  });

  it("says type and status in words on every bar, never by colour alone", () => {
    const html = render();
    expect(html).toContain("Marco · Vacation");
    expect(html).toContain("Priya · Vacation");
    expect(html).toContain("Approved");
    expect(html).toContain("Pending");
    expect(html).toContain("Appr.");
    expect(html).toContain("Pend.");
  });

  it("styles approved solid and pending striped", () => {
    const html = render();
    expect(html).toMatch(/bg-\(color:--leave-color\) text-white/);
    expect(html).toContain("leave-stripes");
  });

  it("hides rejected requests unless the switch is on", () => {
    const off = render();
    expect(off).toContain('role="switch"');
    expect(off).toContain('aria-checked="false"');
    expect(off).not.toContain("Ana · Unpaid");
    expect(off).not.toContain("Rejected · dashed");

    const on = render({ showRejected: true });
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain("Ana · Unpaid");
    expect(on).toContain("Rejected · dashed");
  });

  it("shows the legend for the three leave types and both statuses", () => {
    const html = render();
    for (const text of ["Vacation", "Sick", "Unpaid", "Approved · solid", "Pending · striped"]) {
      expect(html).toContain(text);
    }
  });

  it("lists every request as text for screen readers and keeps the bars out of the tree", () => {
    const html = render();
    expect(html).toContain("Marco Santos, Vacation, approved, Oct 1 to Oct 3");
    expect(html).toContain("Priya Shah, Vacation, pending, Oct 19 to Oct 21");
    expect(html).toMatch(/aria-hidden="true"[^>]*class="relative grid grid-cols-7/);
  });

  it("writes the owners summary for small screens", () => {
    const html = render();
    expect(html).toContain("You: Oct 1–3");
    expect(html).toContain("Team: Priya 19–21");
    expect(html).toContain("Appr. = Approved · Pend. = Pending");
  });

  it("says so when the calendar cannot be loaded, instead of showing an empty month", () => {
    const html = render({ requests: null });
    expect(html).toContain('role="status"');
    expect(html).toContain("not available right now");
    expect(html).not.toContain("Marco · Vacation");
  });

  it("says there is no leave this month for screen readers when the month is empty", () => {
    expect(render({ requests: [] })).toContain("No leave this month.");
  });
});
