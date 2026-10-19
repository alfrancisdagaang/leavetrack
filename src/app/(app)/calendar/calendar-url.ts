import type { HrCalendarQuery } from "@/lib/leave/schemas";

const BASE = "/calendar";

/**
 * The address of the HR calendar for a set of filters. Only non-default values are written; a name
 * search and a page are only kept while a day is open.
 */
export function calendarHref(
  query: HrCalendarQuery,
  change: Partial<HrCalendarQuery> = {},
): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.month) params.set("month", next.month);
  if (next.managerId) params.set("team", next.managerId);
  if (next.leaveTypeId) params.set("type", next.leaveTypeId);
  if (next.day) {
    params.set("day", next.day);
    if (next.q) params.set("q", next.q);
    if (next.page > 1) params.set("page", String(next.page));
  }
  const qs = params.toString();
  return `${BASE}${qs ? `?${qs}` : ""}`;
}
