import type { UserRole } from "@/lib/db/types";
import { todayIn } from "@/lib/leave/calendar-layout";
import { formatDateRange } from "@/lib/leave/format";
import type { NotificationList, NotificationView } from "@/lib/leave/notifications";
import { NOTIFICATION_KINDS } from "@/lib/db/types";
import { leaveTypeLook } from "@/components/ui/leave-type-icon";

/**
 * TASK-055 (EPIC-9). Pure display helpers for the notification bell: the sentence, the time, the
 * link, the badge and the icon. The API returns structured fields only (TASK-054); the wording
 * lives here, in one place. No I/O, no React.
 */

export type NotificationSentence = {
  /** The person's name, shown in bold when the sentence is about someone else; null otherwise. */
  who: string | null;
  text: string;
  /** The request was soft-deleted since; the bell adds a small note. */
  removed: boolean;
};

const when = (n: NotificationView) =>
  `${formatDateRange(n.startDate, n.endDate)}, ${n.endDate.slice(0, 4)}`;

/** "Elena Cruz requested Vacation leave, Nov 2–3, 2026", or "Your Vacation request, ..., was approved". */
export function notificationSentence(
  n: NotificationView,
  viewerRole: UserRole,
): NotificationSentence {
  const removed = n.requestRemoved;
  const own = viewerRole === "employee";
  switch (n.kind) {
    case "submitted":
      return {
        who: n.employeeName,
        text: `requested ${n.leaveTypeName} leave, ${when(n)}`,
        removed,
      };
    case "approved":
    case "rejected": {
      const what = `${n.leaveTypeName} request, ${when(n)}, was ${n.kind}`;
      return own
        ? { who: null, text: `Your ${what}`, removed }
        : { who: null, text: `${n.employeeName}’s ${what}`, removed };
    }
    case "overridden":
      return own
        ? {
            who: null,
            text: `HR approved your ${n.leaveTypeName} request, ${when(n)}, over your balance`,
            removed,
          }
        : {
            who: null,
            text: `HR approved ${n.employeeName}’s ${n.leaveTypeName} request, ${when(n)}, over their balance`,
            removed,
          };
  }
}

/**
 * Where a row goes: only pages that exist for the role (a manager's Team Approvals, an employee's
 * My Balance). Nothing exists per request, so there is no per-request link.
 */
export function notificationHref(role: UserRole): string {
  if (role === "manager") return "/approvals";
  if (role === "employee") return "/balance";
  return "/dashboard";
}

/** The count in the badge: nothing at zero or unknown, the number up to 99, then "99+". */
export function badgeText(count: number | null): string | null {
  if (count === null || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

/** The bell button's accessible name, which carries the count (the badge itself is decorative). */
export function bellLabel(count: number | null): string {
  if (count === null || count <= 0) return "Notifications";
  return `Notifications, ${count > 99 ? "more than 99" : count} unread`;
}

/**
 * "Just now", "5 min ago", "2 hours ago", "Yesterday", then "Oct 17" (with the year when it is not
 * this year), all by the calendar in `timeZone` (APP_TIMEZONE), never the viewer's zone.
 */
export function relativeTime(createdAt: string, now: Date, timeZone: string): string {
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return "";
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const day = todayIn(timeZone, at);
  const today = todayIn(timeZone, now);
  if (day === today) {
    const hours = Math.floor(minutes / 60);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  if (day === todayIn(timeZone, new Date(now.getTime() - 86_400_000))) return "Yesterday";
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" as const }),
  }).format(at);
  return label;
}

export type NotificationIcon = { icon: string; tint: string };

/** The round icon of a row: the leave type for a new request, a tick or a cross for a decision. */
export function notificationIcon(n: NotificationView): NotificationIcon {
  switch (n.kind) {
    case "submitted":
      return leaveTypeLook(n.leaveTypeName);
    case "rejected":
      return { icon: "/icons/x.svg", tint: "bg-event-rejected/10" };
    case "approved":
    case "overridden":
      return { icon: "/icons/check-success.svg", tint: "bg-event-approved/10" };
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";

function toView(v: unknown): NotificationView | null {
  if (!isRecord(v)) return null;
  const {
    id,
    kind,
    createdAt,
    readAt,
    requestId,
    employeeName,
    leaveTypeName,
    startDate,
    endDate,
    requestRemoved,
  } = v;
  if (
    !isString(id) ||
    !isString(kind) ||
    !(NOTIFICATION_KINDS as readonly string[]).includes(kind) ||
    !isString(createdAt) ||
    !(readAt === null || isString(readAt)) ||
    !isString(requestId) ||
    !isString(employeeName) ||
    !isString(leaveTypeName) ||
    !isString(startDate) ||
    !isString(endDate) ||
    typeof requestRemoved !== "boolean"
  ) {
    return null;
  }
  return {
    id,
    kind: kind as NotificationView["kind"],
    createdAt,
    readAt,
    requestId,
    employeeName,
    leaveTypeName,
    startDate,
    endDate,
    requestRemoved,
  };
}

/**
 * Reads the GET /api/notifications envelope the browser receives. A hand-written guard rather than
 * zod, to keep the client bundle small; returns null for anything that is not the success shape,
 * so a malformed answer is treated like a failed read.
 */
export function parseNotificationList(json: unknown): NotificationList | null {
  if (!isRecord(json) || json.success !== true || !isRecord(json.data)) return null;
  const { unread, notifications } = json.data;
  if (typeof unread !== "number" || !Number.isInteger(unread) || unread < 0) return null;
  if (!Array.isArray(notifications)) return null;
  const items: NotificationView[] = [];
  for (const raw of notifications) {
    const view = toView(raw);
    if (!view) return null;
    items.push(view);
  }
  return { unread, notifications: items };
}

/** Reads the POST /api/notifications/read envelope: the server's remaining unread count, or null. */
export function parseMarkResult(json: unknown): { marked: number; unread: number } | null {
  if (!isRecord(json) || json.success !== true || !isRecord(json.data)) return null;
  const { marked, unread } = json.data;
  if (typeof marked !== "number" || typeof unread !== "number") return null;
  return { marked, unread };
}
