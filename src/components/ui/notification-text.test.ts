import { describe, expect, it } from "vitest";
import type { NotificationView } from "@/lib/leave/notifications";
import {
  badgeText,
  bellLabel,
  notificationHref,
  notificationIcon,
  notificationSentence,
  parseMarkResult,
  parseNotificationList,
  relativeTime,
} from "@/components/ui/notification-text";

const N: NotificationView = {
  id: "40000000-0000-4000-8000-000000000001",
  kind: "submitted",
  createdAt: "2026-10-20T08:00:00.123456+00:00",
  readAt: null,
  requestId: "30000000-0000-4000-8000-000000000001",
  employeeName: "Elena Cruz",
  leaveTypeName: "Vacation",
  startDate: "2026-11-02",
  endDate: "2026-11-03",
  requestRemoved: false,
};
const of = (over: Partial<NotificationView>): NotificationView => ({ ...N, ...over });

describe("notificationSentence (TASK-055)", () => {
  it("a new request names the employee in bold and says what was asked", () => {
    expect(notificationSentence(N, "manager")).toEqual({
      who: "Elena Cruz",
      text: "requested Vacation leave, Nov 2–3, 2026",
      removed: false,
    });
  });

  it("a decision speaks to the employee in the second person", () => {
    expect(notificationSentence(of({ kind: "approved" }), "employee").text).toBe(
      "Your Vacation request, Nov 2–3, 2026, was approved",
    );
    expect(notificationSentence(of({ kind: "rejected" }), "employee").text).toBe(
      "Your Vacation request, Nov 2–3, 2026, was rejected",
    );
  });

  it("an override reads differently for the employee and for their manager", () => {
    expect(notificationSentence(of({ kind: "overridden" }), "employee").text).toBe(
      "HR approved your Vacation request, Nov 2–3, 2026, over your balance",
    );
    expect(notificationSentence(of({ kind: "overridden" }), "manager").text).toBe(
      "HR approved Elena Cruz’s Vacation request, Nov 2–3, 2026, over their balance",
    );
  });

  it("a decision seen by someone else names the employee with no stray space before ’s", () => {
    const s = notificationSentence(of({ kind: "approved" }), "manager");
    expect(s.who).toBeNull();
    expect(s.text).toBe("Elena Cruz’s Vacation request, Nov 2–3, 2026, was approved");
  });

  it("flags a removed request and keeps the year of the end date", () => {
    const s = notificationSentence(
      of({ requestRemoved: true, startDate: "2026-12-30", endDate: "2027-01-02" }),
      "manager",
    );
    expect(s.removed).toBe(true);
    expect(s.text).toContain("Dec 30–Jan 2, 2027");
  });

  it("builds the text from fields only: the reason and a note have nowhere to appear", () => {
    const text = JSON.stringify(notificationSentence(N, "manager"));
    expect(text).not.toMatch(/reason|note/i);
  });
});

describe("notificationHref, badgeText and bellLabel", () => {
  it("links only to pages that exist for the role", () => {
    expect(notificationHref("manager")).toBe("/approvals");
    expect(notificationHref("employee")).toBe("/balance");
    expect(notificationHref("hr_admin")).toBe("/dashboard");
  });

  it("shows no badge at zero or unknown, the number to 99, then 99+", () => {
    expect(badgeText(null)).toBeNull();
    expect(badgeText(0)).toBeNull();
    expect(badgeText(1)).toBe("1");
    expect(badgeText(99)).toBe("99");
    expect(badgeText(100)).toBe("99+");
    expect(badgeText(120)).toBe("99+");
  });

  it("puts the count in the button's accessible name (the badge is decorative)", () => {
    expect(bellLabel(null)).toBe("Notifications");
    expect(bellLabel(0)).toBe("Notifications");
    expect(bellLabel(3)).toBe("Notifications, 3 unread");
    expect(bellLabel(120)).toBe("Notifications, more than 99 unread");
  });
});

describe("relativeTime (by the app's time zone)", () => {
  const now = new Date("2026-10-20T08:00:00Z");
  it("counts minutes, hours, yesterday, then the date", () => {
    expect(relativeTime("2026-10-20T07:59:50Z", now, "UTC")).toBe("Just now");
    expect(relativeTime("2026-10-20T07:55:00Z", now, "UTC")).toBe("5 min ago");
    expect(relativeTime("2026-10-20T05:00:00Z", now, "UTC")).toBe("3 hours ago");
    expect(relativeTime("2026-10-20T06:30:00Z", now, "UTC")).toBe("1 hour ago");
    expect(relativeTime("2026-10-19T12:00:00Z", now, "UTC")).toBe("Yesterday");
    expect(relativeTime("2026-10-17T12:00:00Z", now, "UTC")).toBe("Oct 17");
    expect(relativeTime("2025-12-31T12:00:00Z", now, "UTC")).toBe("Dec 31, 2025");
  });

  it("decides 'yesterday' by the app's calendar, not the viewer's", () => {
    // 20:00 UTC on Oct 19 is already Oct 20 in Manila: the same day as `now` there.
    expect(
      relativeTime("2026-10-19T20:00:00Z", new Date("2026-10-20T09:00:00Z"), "Asia/Manila"),
    ).toBe("13 hours ago");
    expect(
      relativeTime("2026-10-19T12:00:00Z", new Date("2026-10-20T09:00:00Z"), "Asia/Manila"),
    ).toBe("Yesterday");
  });

  it("parses the database's microsecond offset format, and tolerates garbage", () => {
    expect(relativeTime("2026-10-20T15:54:00.123456+08:00", now, "UTC")).toBe("5 min ago");
    expect(relativeTime("not a date", now, "UTC")).toBe("");
  });
});

describe("notificationIcon", () => {
  it("uses the leave type for a request and a tick or a cross for a decision", () => {
    expect(notificationIcon(of({ leaveTypeName: "Sick" })).icon).toBe("/icons/heart-pulse.svg");
    expect(notificationIcon(of({ kind: "approved" })).icon).toBe("/icons/check-success.svg");
    expect(notificationIcon(of({ kind: "overridden" })).icon).toBe("/icons/check-success.svg");
    expect(notificationIcon(of({ kind: "rejected" })).icon).toBe("/icons/x.svg");
  });
});

describe("parseNotificationList and parseMarkResult", () => {
  const good = { success: true, data: { unread: 1, notifications: [N] } };

  it("accepts the real response", () => {
    expect(parseNotificationList(good)).toEqual({ unread: 1, notifications: [N] });
    expect(
      parseNotificationList({ success: true, data: { unread: 0, notifications: [] } }),
    ).toEqual({ unread: 0, notifications: [] });
  });

  it("rejects an error envelope, a missing field, a wrong kind and garbage", () => {
    for (const bad of [
      null,
      "x",
      [],
      { success: false, error: { code: "UNAUTHORIZED", message: "no" } },
      { success: true },
      { success: true, data: { unread: -1, notifications: [] } },
      { success: true, data: { unread: 1.5, notifications: [] } },
      { success: true, data: { unread: 1, notifications: "x" } },
      { success: true, data: { unread: 1, notifications: [{ ...N, kind: "bogus" }] } },
      { success: true, data: { unread: 1, notifications: [{ ...N, requestRemoved: "no" }] } },
      { success: true, data: { unread: 1, notifications: [{ ...N, employeeName: undefined }] } },
    ]) {
      expect(parseNotificationList(bad)).toBeNull();
    }
  });

  it("reads the mark-read answer, and nothing else", () => {
    expect(parseMarkResult({ success: true, data: { marked: 2, unread: 0 } })).toEqual({
      marked: 2,
      unread: 0,
    });
    expect(parseMarkResult({ success: false })).toBeNull();
    expect(parseMarkResult({ success: true, data: { marked: "2" } })).toBeNull();
  });
});
