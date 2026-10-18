import type { BalanceSummaryItem } from "@/lib/leave/balance";
import type { IsoDate } from "@/lib/leave/calendar-layout";
import { formatDateRange } from "@/lib/leave/format";
import { countWorkingDays, isRealIsoDate } from "@/lib/leave/working-days";

/**
 * Pure logic behind the Request leave page's "Request summary" card. No I/O. The server stays the
 * source of truth (validation and the over-balance warning in the submit response); this is the
 * early, advisory view shown while the person fills in the form.
 */

export type RequestPreview =
  /** Not enough input yet: a date is missing. */
  | { kind: "empty" }
  /** Both dates are set but the end is before the start. */
  | { kind: "invalid" }
  | {
      kind: "ready";
      leaveTypeName: string;
      /** "Mon 2 Nov – Wed 4 Nov 2026" */
      rangeText: string;
      /** "Nov 2–4 2026" (shared with the success screen) */
      shortRangeText: string;
      days: number;
      /** "3 working days (Mon-Fri)" */
      daysText: string;
      /** Available minus these days; null for a type with no balance (Unpaid). */
      balanceAfter: number | null;
      /** "7 days", "−1 day"; null when there is no balance. */
      balanceAfterText: string | null;
      over: boolean;
    };

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mon 2 Nov" for an ISO date (weekday from the calendar date itself, never a time zone). */
function dayLabel(iso: IsoDate): string {
  const [y, m, d] = [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))];
  const weekday = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${MONTH[m - 1]}`;
}

/** "Mon 2 Nov – Wed 4 Nov 2026"; one day reads "Mon 2 Nov 2026". Years show once, or on both ends if they differ. */
export function formatSummaryRange(start: IsoDate, end: IsoDate): string {
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  if (start === end) return `${dayLabel(start)} ${startYear}`;
  const from = startYear === endYear ? dayLabel(start) : `${dayLabel(start)} ${startYear}`;
  return `${from} – ${dayLabel(end)} ${endYear}`;
}

/** "7 days", "1 day", "0 days", "−1 day" (a real minus sign; singular for 1 and −1). */
export function formatDays(n: number): string {
  const unit = Math.abs(n) === 1 ? "day" : "days";
  return `${n < 0 ? "−" : ""}${Math.abs(n)} ${unit}`;
}

/** "3 working days (Mon-Fri)", "1 working day (Mon-Fri)". */
export function formatWorkingDays(n: number): string {
  return `${n} working day${n === 1 ? "" : "s"} (Mon-Fri)`;
}

export function buildPreview(input: {
  balances: readonly BalanceSummaryItem[];
  leaveTypeId: string;
  startDate: string;
  endDate: string;
}): RequestPreview {
  const { balances, leaveTypeId, startDate, endDate } = input;
  if (!isRealIsoDate(startDate) || !isRealIsoDate(endDate)) return { kind: "empty" };
  if (endDate < startDate) return { kind: "invalid" };

  const item = balances.find((b) => b.leaveTypeId === leaveTypeId);
  if (!item) return { kind: "empty" };

  const days = countWorkingDays(startDate, endDate);
  const balanceAfter = item.tracksBalance && item.available !== null ? item.available - days : null;
  return {
    kind: "ready",
    leaveTypeName: item.leaveTypeName,
    rangeText: formatSummaryRange(startDate, endDate),
    shortRangeText: `${formatDateRange(startDate, endDate)} ${endDate.slice(0, 4)}`,
    days,
    daysText: formatWorkingDays(days),
    balanceAfter,
    balanceAfterText: balanceAfter === null ? null : formatDays(balanceAfter),
    over: balanceAfter !== null && balanceAfter < 0,
  };
}
