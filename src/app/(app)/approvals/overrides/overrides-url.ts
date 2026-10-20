import { formatDay } from "@/app/(app)/audit/audit-format";
import type { FilterChip } from "@/components/ui/list-filters";
import {
  DEFAULT_OVERRIDE_QUERY,
  overrideDefaultDir,
  overrideDefaultSort,
  type OverrideListQuery,
  type OverrideSort,
  type OverrideView,
} from "@/lib/leave/override-list-schema";

const BASE = "/approvals/overrides";

/** The address of Balance Overrides for a view, a search, filters, an order and a page. Only non-default values are written. */
export function overridesHref(query: OverrideListQuery, page = 1): string {
  const params = new URLSearchParams();
  if (query.view !== "waiting") params.set("view", query.view);
  if (query.q) params.set("q", query.q);
  if (query.type) params.set("type", query.type);
  if (query.team) params.set("team", query.team);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.sort !== overrideDefaultSort(query.view)) params.set("sort", query.sort);
  if (query.dir !== overrideDefaultDir(query.sort)) params.set("dir", query.dir);
  if (query.per !== DEFAULT_OVERRIDE_QUERY.per) params.set("per", String(query.per));
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `${BASE}${qs ? `?${qs}` : ""}`;
}

/** The plain address of a view: switching view clears the filters. */
export function viewHref(view: OverrideView): string {
  return view === "waiting" ? BASE : `${BASE}?view=${view}`;
}

/** A column header's link: the first click sorts that way, a second click on the same column reverses it. */
export function sortHref(query: OverrideListQuery, sort: OverrideSort): string {
  const dir =
    query.sort === sort ? (query.dir === "asc" ? "desc" : "asc") : overrideDefaultDir(sort);
  return overridesHref({ ...query, sort, dir }, 1);
}

/** The same view, order and page size with every filter removed. */
export function clearedHref(query: OverrideListQuery): string {
  return overridesHref(
    { ...query, q: undefined, type: undefined, team: undefined, from: undefined, to: undefined },
    1,
  );
}

/** The "Sort by" choices of a view: a value is "sort:dir". */
export const SORT_OPTIONS: Record<OverrideView, { value: string; label: string }[]> = {
  waiting: [
    { value: "created:asc", label: "Oldest request first" },
    { value: "created:desc", label: "Newest request first" },
    { value: "shortfall:desc", label: "Biggest shortfall first" },
    { value: "shortfall:asc", label: "Smallest shortfall first" },
    { value: "start:asc", label: "Leave starts soonest" },
    { value: "start:desc", label: "Leave starts latest" },
    { value: "name:asc", label: "Name A to Z" },
    { value: "name:desc", label: "Name Z to A" },
    { value: "days:desc", label: "Most working days" },
    { value: "days:asc", label: "Fewest working days" },
  ],
  overridden: [
    { value: "approved:desc", label: "Latest approval first" },
    { value: "approved:asc", label: "Earliest approval first" },
    { value: "shortfall:desc", label: "Biggest shortfall first" },
    { value: "shortfall:asc", label: "Smallest shortfall first" },
    { value: "start:asc", label: "Leave starts soonest" },
    { value: "start:desc", label: "Leave starts latest" },
    { value: "name:asc", label: "Name A to Z" },
    { value: "name:desc", label: "Name Z to A" },
  ],
};

/** One removable chip per applied filter (the search, leave type, team and the two dates). */
export function filterChips(
  query: OverrideListQuery,
  names: { types: Record<string, string>; teams: Record<string, string> },
): FilterChip[] {
  const without = (over: Partial<OverrideListQuery>) => overridesHref({ ...query, ...over }, 1);
  const chips: FilterChip[] = [];
  if (query.q) chips.push({ key: "q", label: `Name: ${query.q}`, href: without({ q: undefined }) });
  if (query.type)
    chips.push({
      key: "type",
      label: `Leave type: ${names.types[query.type] ?? "Unknown"}`,
      href: without({ type: undefined }),
    });
  if (query.team)
    chips.push({
      key: "team",
      label: `Team: ${names.teams[query.team] ?? "Unknown"}`,
      href: without({ team: undefined }),
    });
  if (query.from)
    chips.push({
      key: "from",
      label: `From ${formatDay(query.from)}`,
      href: without({ from: undefined }),
    });
  if (query.to)
    chips.push({ key: "to", label: `To ${formatDay(query.to)}`, href: without({ to: undefined }) });
  return chips;
}
