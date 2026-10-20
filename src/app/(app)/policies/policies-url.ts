import {
  DEFAULT_POLICY_QUERY,
  defaultDir,
  type PolicyListQuery,
  type PolicySort,
  type PolicyStatus,
} from "@/lib/leave/policies-schema";

const BASE = "/policies";

/** The address of the Leave Policies page for a search, filters, order and page. Only non-default values are written. */
export function policiesHref(query: PolicyListQuery, page = 1): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.team) params.set("team", query.team);
  if (query.type) params.set("type", query.type);
  if (query.status) params.set("status", query.status);
  if (query.sort !== DEFAULT_POLICY_QUERY.sort) params.set("sort", query.sort);
  if (query.dir !== defaultDir(query.sort)) params.set("dir", query.dir);
  if (query.per !== DEFAULT_POLICY_QUERY.per) params.set("per", String(query.per));
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `${BASE}${qs ? `?${qs}` : ""}`;
}

/** A column header's link: the first click sorts that way, a second click on the same column reverses it. */
export function sortHref(query: PolicyListQuery, sort: PolicySort): string {
  const reversed = query.sort === sort ? (query.dir === "asc" ? "desc" : "asc") : defaultDir(sort);
  return policiesHref({ ...query, sort, dir: reversed }, 1);
}

/** The same search, order and page size with every filter removed. */
export function clearedHref(query: PolicyListQuery): string {
  return policiesHref(
    { ...query, q: undefined, team: undefined, type: undefined, status: undefined },
    1,
  );
}

export const STATUS_LABEL: Record<PolicyStatus, string> = {
  none: "No policy yet",
  has: "Has a policy",
  changed: "Changed this month",
};

/** The sort choices in the "Sort by" list: a value is "sort:dir". */
export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "name:asc", label: "Name A to Z" },
  { value: "name:desc", label: "Name Z to A" },
  { value: "vacation:desc", label: "Vacation rate, high to low" },
  { value: "vacation:asc", label: "Vacation rate, low to high" },
  { value: "sick:desc", label: "Sick rate, high to low" },
  { value: "sick:asc", label: "Sick rate, low to high" },
  { value: "changed:desc", label: "Last changed, newest first" },
  { value: "changed:asc", label: "Last changed, oldest first" },
];

export type PolicyChip = { key: string; label: string; href: string };

/** One removable chip per applied filter (the search, team, leave type and status). */
export function filterChips(
  query: PolicyListQuery,
  names: { teams: Record<string, string>; types: Record<string, string> },
): PolicyChip[] {
  const without = (over: Partial<PolicyListQuery>) => policiesHref({ ...query, ...over }, 1);
  const chips: PolicyChip[] = [];
  if (query.q) chips.push({ key: "q", label: `Name: ${query.q}`, href: without({ q: undefined }) });
  if (query.team)
    chips.push({
      key: "team",
      label: `Team: ${names.teams[query.team] ?? "Unknown"}`,
      href: without({ team: undefined }),
    });
  if (query.type)
    chips.push({
      key: "type",
      label: `Leave type: ${names.types[query.type] ?? "Unknown"}`,
      href: without({ type: undefined }),
    });
  if (query.status)
    chips.push({
      key: "status",
      label: `Status: ${STATUS_LABEL[query.status]}`,
      href: without({ status: undefined }),
    });
  return chips;
}
