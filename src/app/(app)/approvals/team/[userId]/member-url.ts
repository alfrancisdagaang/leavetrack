import type { TeamMemberQuery } from "@/lib/leave/schemas";

/**
 * The address of a team member's page for a set of filters and a page number. Only values that differ
 * from the defaults are written, so the plain address stays clean. The person's id comes from the
 * database row, never from the client.
 */
export function memberHref(
  memberId: string,
  query: TeamMemberQuery,
  currentYear: number,
  page = 1,
): string {
  const params = new URLSearchParams();
  if (query.leaveTypeId) params.set("type", query.leaveTypeId);
  if (query.status) params.set("status", query.status);
  if (query.year !== currentYear) params.set("year", String(query.year));
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/approvals/team/${memberId}${qs ? `?${qs}` : ""}`;
}

/** The values chosen in the filter form. An empty string means "All". */
export type FilterValues = { type: string; status: string; year: string };

/**
 * The address for the values chosen in the filter form (always page 1). Anything odd falls back to the
 * default, and the page checks every value again on the server, so this never has to be trusted.
 */
export function filtersHref(memberId: string, values: FilterValues, currentYear: number): string {
  const status =
    values.status === "pending" || values.status === "approved" || values.status === "rejected"
      ? values.status
      : undefined;
  const year = Number(values.year);
  return memberHref(
    memberId,
    {
      leaveTypeId: values.type || undefined,
      status,
      year: Number.isInteger(year) && year > 0 ? year : currentYear,
      page: 1,
    },
    currentYear,
  );
}

/** One applied filter, shown as a chip, with the address that removes just that filter. */
export type FilterChip = { key: "type" | "status" | "year"; label: string; removeHref: string };

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** The filters that differ from the defaults: a leave type, a status, and a year other than this one. */
export function filterChips(
  memberId: string,
  query: TeamMemberQuery,
  leaveTypes: readonly { id: string; name: string }[],
  currentYear: number,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (query.leaveTypeId) {
    const name = leaveTypes.find((t) => t.id === query.leaveTypeId)?.name ?? "Unknown";
    chips.push({
      key: "type",
      label: `Leave type: ${name}`,
      removeHref: memberHref(memberId, { ...query, leaveTypeId: undefined, page: 1 }, currentYear),
    });
  }
  if (query.status) {
    chips.push({
      key: "status",
      label: `Status: ${capitalise(query.status)}`,
      removeHref: memberHref(memberId, { ...query, status: undefined, page: 1 }, currentYear),
    });
  }
  if (query.year !== currentYear) {
    chips.push({
      key: "year",
      label: `Year: ${query.year}`,
      removeHref: memberHref(memberId, { ...query, year: currentYear, page: 1 }, currentYear),
    });
  }
  return chips;
}
