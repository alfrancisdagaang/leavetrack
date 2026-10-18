import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "@/lib/leave/activity";
import { RecentActivityCard } from "@/components/ui/recent-activity";

const NOW = new Date("2026-10-15T09:00:00Z");
const ZONE = "Asia/Manila";

const event = (over: Partial<ActivityEvent>): ActivityEvent => ({
  id: "e1",
  action: "submitted",
  occurredAt: "2026-10-15T01:42:00Z",
  actorId: "priya",
  actorName: "Priya Shah",
  ownerId: "priya",
  ownerName: "Priya Shah",
  leaveTypeName: "Vacation",
  startDate: "2026-10-19",
  endDate: "2026-10-21",
  ...over,
});

const render = (events: readonly ActivityEvent[] | null) =>
  renderToStaticMarkup(createElement(RecentActivityCard, { events, now: NOW, timeZone: ZONE }));

describe("RecentActivityCard", () => {
  it("AC5: shows who did what, the type, the dates and the time in the app time zone", () => {
    const out = render([event({})]);
    expect(out).toContain("Recent activity");
    expect(out).toContain("Priya Shah submitted Vacation · Oct 19–21");
    expect(out).toContain("Today, Oct 15 · 9:42 AM");
    expect(out).toContain('dateTime="2026-10-15T01:42:00Z"');
  });

  it("AC6: every event carries its label as text, one per action", () => {
    const out = render([
      event({ id: "a", action: "submitted" }),
      event({ id: "b", action: "approved", actorId: "m", actorName: "Marco Santos" }),
      event({ id: "c", action: "rejected", actorId: "m", actorName: "Marco Santos" }),
      event({ id: "d", action: "soft_deleted" }),
    ]);
    for (const label of ["Submitted", "Approved", "Rejected", "Cancelled"]) {
      expect(out).toContain(`>${label}<`);
    }
  });

  it("uses the Figma icons, decorative (the label carries the meaning)", () => {
    const out = render([
      event({ id: "a", action: "submitted" }),
      event({ id: "b", action: "approved" }),
      event({ id: "c", action: "rejected" }),
    ]);
    for (const icon of ["send.svg", "check.svg", "x.svg"]) expect(out).toContain(icon);
    expect(out).toContain('alt=""');
  });

  it("AC7: says so when there is nothing to list", () => {
    expect(render([])).toContain("No recent activity.");
  });

  it("AC7: says it is not available when the read failed, as an alert", () => {
    const out = render(null);
    expect(out).toContain("Recent activity is not available right now.");
    expect(out).toContain('role="alert"');
  });

  it("AC8: wraps long sentences instead of forcing horizontal scroll", () => {
    const out = render([event({})]);
    expect(out).toContain("min-w-0");
    expect(out).toContain("break-words");
  });
});
