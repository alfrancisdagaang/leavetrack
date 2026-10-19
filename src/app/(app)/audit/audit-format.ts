import type { BadgeVariant } from "@/components/ui/badge";
import type { LeaveStatus } from "@/lib/db/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const monthDay = (iso: string) =>
  `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""} ${Number(iso.slice(8, 10))}`;

/** "Nov 2, 2026" from `2026-11-02`. The year is always shown: the record goes back three years. */
export function formatDay(iso: string): string {
  return `${monthDay(iso)}, ${iso.slice(0, 4)}`;
}

/** "Nov 2, 2026", "Nov 2 to Nov 4, 2026", or "Dec 30, 2026 to Jan 2, 2027" across a year. */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatDay(start);
  if (start.slice(0, 4) === end.slice(0, 4)) return `${monthDay(start)} to ${formatDay(end)}`;
  return `${formatDay(start)} to ${formatDay(end)}`;
}

/** "Oct 18, 2026, 09:12 UTC": the zone is written out, so there is no doubt which day a record is on. */
export function utc(value: Date | string): string {
  const iso = new Date(value).toISOString();
  return `${formatDay(iso.slice(0, 10))}, ${iso.slice(11, 16)} UTC`;
}

export const days = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;

/**
 * The status shown for a request. A soft-deleted request is shown as removed whatever its status was,
 * and written out, so the table never relies on colour alone. An approval that HR made as an
 * override says so (TASK-040); the summary buckets still count it as approved.
 */
export function statusBadge(
  status: LeaveStatus,
  isDeleted: boolean,
  overridden = false,
): { variant: BadgeVariant; label: string } {
  if (isDeleted) return { variant: "neutral", label: "Removed (soft-deleted)" };
  if (status === "approved") {
    return { variant: "approved", label: overridden ? "Approved (HR override)" : "Approved" };
  }
  if (status === "rejected") return { variant: "rejected", label: "Rejected" };
  return { variant: "pending", label: "Pending" };
}
