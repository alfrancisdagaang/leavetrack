import {
  firstParam,
  readCommon,
  readOneOf,
  readUuid,
  type CommonQuery,
  type SearchParams,
  type SortDir,
} from "@/lib/leave/list-query";

/** The two views of Team Approvals: what waits for the manager, and what was decided. */
export const TEAM_VIEWS = ["pending", "decided"] as const;
export type TeamView = (typeof TEAM_VIEWS)[number];

/**
 * Pending status: `ok` the manager can approve it; `over` it asks for more days than the balance, so only
 * HR can override it (the manager can only reject); `blocked` there is no balance record or the balance is
 * negative, so nobody can approve it until the balance is fixed. The same three states as `checkOverBalance`.
 */
export const TEAM_PENDING_STATUSES = ["ok", "over", "blocked"] as const;
/** Decided status: `overridden` is an approval by HR over the balance. */
export const TEAM_DECIDED_STATUSES = ["approved", "rejected", "overridden"] as const;
export type TeamPendingStatus = (typeof TEAM_PENDING_STATUSES)[number];
export type TeamDecidedStatus = (typeof TEAM_DECIDED_STATUSES)[number];

/** `created` is when the request was submitted; `days` the working days it asks for. */
export const TEAM_PENDING_SORTS = ["created", "start", "name", "days"] as const;
/** `decided` is when the decision was made. */
export const TEAM_DECIDED_SORTS = ["decided", "start", "name"] as const;
export type TeamPendingSort = (typeof TEAM_PENDING_SORTS)[number];
export type TeamDecidedSort = (typeof TEAM_DECIDED_SORTS)[number];
export type TeamSort = TeamPendingSort | TeamDecidedSort;

export type TeamQueueQuery = CommonQuery & {
  view: TeamView;
  /** A leave type id. */
  type: string | undefined;
  /** One of the pending statuses in the pending view, one of the decided statuses in the decided view. */
  status: TeamPendingStatus | TeamDecidedStatus | undefined;
  sort: TeamSort;
  dir: SortDir;
};

/** The direction a sort starts in: oldest first, A to Z, earliest leave first; most days and latest decision first. */
export const teamDefaultDir = (sort: TeamSort): SortDir =>
  sort === "days" || sort === "decided" ? "desc" : "asc";

export const teamDefaultSort = (view: TeamView): TeamSort =>
  view === "decided" ? "decided" : "created";

/**
 * The address of Team Approvals: `view`, `q`, `type`, `status`, `from`, `to`, `sort`, `dir`, `per`, `page`. A bad
 * value is ignored, never an error, and named in `ignored` so the page can say so. A status or sort that belongs
 * to the other view is ignored too. Sort comes from a fixed list per view: it is never put into SQL as text.
 */
export function parseTeamQueueQuery(params: SearchParams): {
  query: TeamQueueQuery;
  ignored: string[];
} {
  const ignored: string[] = [];
  const view = readOneOf(params, "view", TEAM_VIEWS, "view", ignored) ?? "pending";
  const common = readCommon(params, ignored);

  const status =
    view === "pending"
      ? readOneOf(params, "status", TEAM_PENDING_STATUSES, "status", ignored)
      : readOneOf(params, "status", TEAM_DECIDED_STATUSES, "status", ignored);

  const sort =
    (view === "pending"
      ? readOneOf(params, "sort", TEAM_PENDING_SORTS, "sort", ignored)
      : readOneOf(params, "sort", TEAM_DECIDED_SORTS, "sort", ignored)) ?? teamDefaultSort(view);

  let dir = teamDefaultDir(sort);
  const rawDir = firstParam(params, "dir");
  if (rawDir !== undefined) {
    if (rawDir === "asc" || rawDir === "desc") dir = rawDir;
    else ignored.push("direction");
  }

  return {
    query: {
      ...common,
      view,
      type: readUuid(params, "type", "leave type", ignored),
      status,
      sort,
      dir,
    },
    ignored,
  };
}

export const DEFAULT_TEAM_QUERY: TeamQueueQuery = parseTeamQueueQuery({}).query;
