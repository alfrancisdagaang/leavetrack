import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { UpcomingLeave } from "@/lib/leave/upcoming";
import { UpcomingLeaveCard } from "@/components/ui/upcoming-leave";

const MARCO = "00000000-0000-4000-8000-000000000002";
const TODAY = "2026-10-15";

const item = (over: Partial<UpcomingLeave>): UpcomingLeave => ({
  id: "r1",
  userId: "priya",
  userName: "Priya Shah",
  leaveTypeName: "Vacation",
  startDate: "2026-10-19",
  endDate: "2026-10-21",
  status: "pending",
  ...over,
});

const render = (items: readonly UpcomingLeave[] | null) =>
  renderToStaticMarkup(createElement(UpcomingLeaveCard, { items, viewerId: MARCO, today: TODAY }));

describe("UpcomingLeaveCard", () => {
  it("AC1: lists each request with name, range, type and the date tile", () => {
    const out = render([item({})]);
    expect(out).toContain("Upcoming leave");
    expect(out).toContain("Priya Shah");
    expect(out).toContain("Oct 19–21 · Vacation");
    expect(out).toContain("OCT");
    expect(out).toContain(">19<");
  });

  it("AC6: the status is written as text, pending and approved", () => {
    const out = render([item({}), item({ id: "r2", status: "approved" })]);
    expect(out).toContain("Pending");
    expect(out).toContain("Approved");
  });

  it("marks the viewer's own request with 'You'", () => {
    const out = render([item({ id: "r3", userId: MARCO, userName: "Marco Santos" })]);
    expect(out).toContain("Marco Santos · You");
    expect(render([item({})])).not.toContain("· You");
  });

  it("AC4: a request under way shows today on its tile but keeps its real range", () => {
    const out = render([item({ startDate: "2026-10-12", endDate: "2026-10-16" })]);
    expect(out).toContain(">15<");
    expect(out).toContain("Oct 12–16 · Vacation");
  });

  it("has no link and no 'View all' while no details page exists", () => {
    const out = render([item({})]);
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("View all");
  });

  it("AC7: says so when there is nothing to list", () => {
    expect(render([])).toContain("No upcoming leave.");
  });

  it("AC7: says it is not available when the read failed, as an alert", () => {
    const out = render(null);
    expect(out).toContain("Upcoming leave is not available right now.");
    expect(out).toContain('role="alert"');
  });

  it("AC8: wraps long names instead of forcing horizontal scroll", () => {
    const out = render([item({})]);
    expect(out).toContain("min-w-0");
    expect(out).toContain("break-words");
  });
});
