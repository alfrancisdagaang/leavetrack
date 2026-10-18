import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "@/lib/leave/activity";
import {
  describeActivity,
  formatActivityTime,
  formatDateRange,
  tileParts,
} from "@/lib/leave/format";

describe("formatDateRange", () => {
  it("writes a single day, a range inside a month, and a range across months", () => {
    expect(formatDateRange("2026-10-23", "2026-10-23")).toBe("Oct 23");
    expect(formatDateRange("2026-10-19", "2026-10-21")).toBe("Oct 19–21");
    expect(formatDateRange("2026-10-30", "2026-11-02")).toBe("Oct 30–Nov 2");
  });

  it("does not pad the day", () => {
    expect(formatDateRange("2026-11-05", "2026-11-06")).toBe("Nov 5–6");
  });
});

describe("tileParts", () => {
  it("shows the start date of a request that has not begun", () => {
    expect(tileParts("2026-10-19", "2026-10-15")).toEqual({ month: "OCT", day: "19" });
  });

  it("shows today for a request already under way (AC4)", () => {
    expect(tileParts("2026-10-12", "2026-10-15")).toEqual({ month: "OCT", day: "15" });
  });

  it("shows the start date when it is today", () => {
    expect(tileParts("2026-10-15", "2026-10-15")).toEqual({ month: "OCT", day: "15" });
  });
});

describe("formatActivityTime (AC5)", () => {
  const now = new Date("2026-10-15T09:00:00Z"); // 5:00 PM on 15 Oct in Manila

  it("says Today for an event on the viewer's day, with a 12-hour clock", () => {
    expect(formatActivityTime("2026-10-15T01:42:00Z", now, "Asia/Manila")).toBe(
      "Today, Oct 15 · 9:42 AM",
    );
  });

  it("drops Today for another day and shows the afternoon as PM", () => {
    expect(formatActivityTime("2026-10-14T07:10:00Z", now, "Asia/Manila")).toBe("Oct 14 · 3:10 PM");
  });

  it("uses the app time zone for the day, not UTC", () => {
    // 17:30 UTC on 14 Oct is already 1:30 AM on 15 Oct in Manila.
    expect(formatActivityTime("2026-10-14T17:30:00Z", now, "Asia/Manila")).toBe(
      "Today, Oct 15 · 1:30 AM",
    );
    expect(formatActivityTime("2026-10-14T17:30:00Z", now, "UTC")).toBe("Oct 14 · 5:30 PM");
  });
});

describe("describeActivity", () => {
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

  it("submitted: the actor is the owner", () => {
    expect(describeActivity(event({}))).toBe("Priya Shah submitted Vacation · Oct 19–21");
  });

  it("rejected and approved name the owner by first name", () => {
    const decided = {
      actorId: "marco",
      actorName: "Marco Santos",
      ownerId: "ana",
      ownerName: "Ana Lopez",
    };
    expect(
      describeActivity(
        event({
          ...decided,
          action: "rejected",
          leaveTypeName: "Unpaid",
          startDate: "2026-10-12",
          endDate: "2026-10-12",
        }),
      ),
    ).toBe("Marco Santos rejected Ana’s Unpaid · Oct 12");
    expect(describeActivity(event({ ...decided, action: "approved" }))).toBe(
      "Marco Santos approved Ana’s Vacation · Oct 19–21",
    );
  });

  it("cancelled: 'their' when the owner cancelled it, the owner's name otherwise", () => {
    expect(describeActivity(event({ action: "soft_deleted" }))).toBe(
      "Priya Shah cancelled their Vacation · Oct 19–21",
    );
    expect(
      describeActivity(
        event({
          action: "soft_deleted",
          actorId: "hana",
          actorName: "Hana Ito",
          ownerId: "leo",
          ownerName: "Leo Garcia",
        }),
      ),
    ).toBe("Hana Ito cancelled Leo’s Vacation · Oct 19–21");
  });
});
