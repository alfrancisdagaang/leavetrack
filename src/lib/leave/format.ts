import type { ActivityEvent } from "@/lib/leave/activity";
import { firstName, todayIn, type IsoDate } from "@/lib/leave/calendar-layout";

/**
 * Pure display helpers for the dashboard's Upcoming leave and Recent activity (US-11). No I/O.
 * Leave dates are ISO `YYYY-MM-DD` strings with no zone; only an audit timestamp has a zone, and
 * it is shown in the app time zone so "Today" matches the viewer's day.
 */

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const monthShort = (iso: IsoDate) => MONTH_SHORT[Number(iso.slice(5, 7)) - 1] ?? "";
const dayOf = (iso: IsoDate) => String(Number(iso.slice(8, 10)));

/** "Oct 23", "Oct 19–21", or "Oct 30–Nov 2" when the request crosses a month. */
export function formatDateRange(start: IsoDate, end: IsoDate): string {
  if (start === end) return `${monthShort(start)} ${dayOf(start)}`;
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${monthShort(start)} ${dayOf(start)}–${dayOf(end)}`;
  }
  return `${monthShort(start)} ${dayOf(start)}–${monthShort(end)} ${dayOf(end)}`;
}

/** The date tile: "OCT" over "19". A request already under way shows today, not its past start. */
export function tileParts(start: IsoDate, today: IsoDate): { month: string; day: string } {
  const shown = start > today ? start : today;
  return { month: monthShort(shown).toUpperCase(), day: dayOf(shown) };
}

/** "Today, Oct 15 · 9:42 AM", or "Oct 14 · 3:10 PM" for any other day, in `timeZone`. */
export function formatActivityTime(occurredAt: string, now: Date, timeZone: string): string {
  const at = new Date(occurredAt);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  const when = `${part("month")} ${part("day")}`;
  const clock = `${part("hour")}:${part("minute")} ${part("dayPeriod")?.toUpperCase()}`;
  const isToday = todayIn(timeZone, at) === todayIn(timeZone, now);
  return `${isToday ? "Today, " : ""}${when} · ${clock}`;
}

/** "Priya Shah submitted Vacation · Oct 19–21", "Marco Santos rejected Ana’s Unpaid · Oct 12". */
export function describeActivity(event: ActivityEvent): string {
  const what = `${event.leaveTypeName} · ${formatDateRange(event.startDate, event.endDate)}`;
  const owner = event.actorId === event.ownerId ? "their" : `${firstName(event.ownerName)}’s`;
  switch (event.action) {
    case "submitted":
      return `${event.actorName} submitted ${what}`;
    case "approved":
      return `${event.actorName} approved ${owner} ${what}`;
    case "rejected":
      return `${event.actorName} rejected ${owner} ${what}`;
    case "soft_deleted":
      return `${event.actorName} cancelled ${owner} ${what}`;
  }
}
