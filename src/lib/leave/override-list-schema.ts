import {
  firstParam,
  readCommon,
  readOneOf,
  readUuid,
  type CommonQuery,
  type SearchParams,
  type SortDir,
} from "@/lib/leave/list-query";

/** The two views of Balance Overrides: what waits for HR, and what HR already overrode. */
export const OVERRIDE_VIEWS = ["waiting", "overridden"] as const;
export type OverrideView = (typeof OVERRIDE_VIEWS)[number];

/** `created` is when the request was submitted, `shortfall` the days it is over the balance, `days` its working days. */
export const OVERRIDE_WAITING_SORTS = ["created", "start", "name", "shortfall", "days"] as const;
/** `approved` is when HR approved the override. */
export const OVERRIDE_DONE_SORTS = ["approved", "shortfall", "name", "start"] as const;
export type OverrideWaitingSort = (typeof OVERRIDE_WAITING_SORTS)[number];
export type OverrideDoneSort = (typeof OVERRIDE_DONE_SORTS)[number];
export type OverrideSort = OverrideWaitingSort | OverrideDoneSort;

export type OverrideListQuery = CommonQuery & {
  view: OverrideView;
  /** A leave type id (only types that track a balance can be over it). */
  type: string | undefined;
  /** Only requests of employees whose manager is this person. */
  team: string | undefined;
  sort: OverrideSort;
  dir: SortDir;
};

/** Oldest first, A to Z, earliest leave first; the biggest shortfall, most days and latest approval first. */
export const overrideDefaultDir = (sort: OverrideSort): SortDir =>
  sort === "shortfall" || sort === "days" || sort === "approved" ? "desc" : "asc";

export const overrideDefaultSort = (view: OverrideView): OverrideSort =>
  view === "overridden" ? "approved" : "created";

/**
 * The address of Balance Overrides: `view`, `q`, `type`, `team`, `from`, `to`, `sort`, `dir`, `per`, `page`. A bad value
 * is ignored, never an error, and named in `ignored`. A sort that belongs to the other view is ignored too. Sort
 * comes from a fixed list per view: it is never put into SQL as text.
 */
export function parseOverrideListQuery(params: SearchParams): {
  query: OverrideListQuery;
  ignored: string[];
} {
  const ignored: string[] = [];
  const view = readOneOf(params, "view", OVERRIDE_VIEWS, "view", ignored) ?? "waiting";
  const common = readCommon(params, ignored);

  const sort =
    (view === "waiting"
      ? readOneOf(params, "sort", OVERRIDE_WAITING_SORTS, "sort", ignored)
      : readOneOf(params, "sort", OVERRIDE_DONE_SORTS, "sort", ignored)) ??
    overrideDefaultSort(view);

  let dir = overrideDefaultDir(sort);
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
      team: readUuid(params, "team", "team", ignored),
      sort,
      dir,
    },
    ignored,
  };
}

export const DEFAULT_OVERRIDE_QUERY: OverrideListQuery = parseOverrideListQuery({}).query;
