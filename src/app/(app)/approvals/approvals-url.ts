import { formatDay } from "@/app/(app)/audit/audit-format";
import type { FilterChip } from "@/components/ui/list-filters";
import {
  DEFAULT_TEAM_QUERY,
  teamDefaultDir,
  teamDefaultSort,
  type TeamDecidedStatus,
  type TeamPendingStatus,
  type TeamQueueQuery,
  type TeamSort,
  type TeamView,
} from "@/lib/leave/team-queue-schema";

const BASE = "/approvals";

/** The address of Team Approvals for a view, a search, filters, an order and a page. Only non-default values are written. */
export function approvalsHref(query: TeamQueueQuery, page = 1): string {
  const params = new URLSearchParams();
  if (query.view !== "pending") params.set("view", query.view);
  if (query.q) params.set("q", query.q);
  if (query.type) params.set("type", query.type);
  if (query.status) params.set("status", query.status);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.sort !== teamDefaultSort(query.view)) params.set("sort", query.sort);
  if (query.dir !== teamDefaultDir(query.sort)) params.set("dir", query.dir);
  if (query.per !== DEFAULT_TEAM_QUERY.per) params.set("per", String(query.per));
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `${BASE}${qs ? `?${qs}` : ""}`;
}

/** The plain address of a view: switching view clears the filters (their choices differ per view). */
export function viewHref(view: TeamView): string {
  return view === "pending" ? BASE : `${BASE}?view=${view}`;
}

/** A column header's link: the first click sorts that way, a second click on the same column reverses it. */
export function sortHref(query: TeamQueueQuery, sort: TeamSort): string {
  const dir = query.sort === sort ? (query.dir === "asc" ? "desc" : "asc") : teamDefaultDir(sort);
  return approvalsHref({ ...query, sort, dir }, 1);
}

/** The same view, order and page size with every filter removed. */
export function clearedHref(query: TeamQueueQuery): string {
  return approvalsHref(
    { ...query, q: undefined, type: undefined, status: undefined, from: undefined, to: undefined },
    1,
  );
}

export const PENDING_STATUS_LABEL: Record<TeamPendingStatus, string> = {
  ok: "Can approve",
  over: "Waiting for HR override",
  blocked: "Needs a balance fix",
};
export const DECIDED_STATUS_LABEL: Record<TeamDecidedStatus, string> = {
  approved: "Approved",
  rejected: "Rejected",
  overridden: "Approved (HR override)",
};

/** The "Sort by" choices of a view: a value is "sort:dir". */
export const SORT_OPTIONS: Record<TeamView, { value: string; label: string }[]> = {
  pending: [
    { value: "created:asc", label: "Oldest request first" },
    { value: "created:desc", label: "Newest request first" },
    { value: "start:asc", label: "Leave starts soonest" },
    { value: "start:desc", label: "Leave starts latest" },
    { value: "name:asc", label: "Name A to Z" },
    { value: "name:desc", label: "Name Z to A" },
    { value: "days:desc", label: "Most working days" },
    { value: "days:asc", label: "Fewest working days" },
  ],
  decided: [
    { value: "decided:desc", label: "Latest decision first" },
    { value: "decided:asc", label: "Earliest decision first" },
    { value: "start:asc", label: "Leave starts soonest" },
    { value: "start:desc", label: "Leave starts latest" },
    { value: "name:asc", label: "Name A to Z" },
    { value: "name:desc", label: "Name Z to A" },
  ],
};

/** One removable chip per applied filter (the search, leave type, status and the two dates). */
export function filterChips(
  query: TeamQueueQuery,
  names: { types: Record<string, string> },
): FilterChip[] {
  const without = (over: Partial<TeamQueueQuery>) => approvalsHref({ ...query, ...over }, 1);
  const labels: Record<string, string> =
    query.view === "pending" ? PENDING_STATUS_LABEL : DECIDED_STATUS_LABEL;
  const chips: FilterChip[] = [];
  if (query.q) chips.push({ key: "q", label: `Name: ${query.q}`, href: without({ q: undefined }) });
  if (query.type)
    chips.push({
      key: "type",
      label: `Leave type: ${names.types[query.type] ?? "Unknown"}`,
      href: without({ type: undefined }),
    });
  if (query.status)
    chips.push({
      key: "status",
      label: `Status: ${labels[query.status] ?? query.status}`,
      href: without({ status: undefined }),
    });
  if (query.from)
    chips.push({
      key: "from",
      label: `From ${formatDay(query.from)}`,
      href: without({ from: undefined }),
    });
  if (query.to)
    chips.push({
      key: "to",
      label: `To ${formatDay(query.to)}`,
      href: without({ to: undefined }),
    });
  return chips;
}
