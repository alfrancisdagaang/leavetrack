import { z } from "zod";
import { isRealIsoDate } from "@/lib/leave/working-days";

/** Rows per page on the approval lists. */
export const LIST_PER_PAGE = [25, 50, 100] as const;
export type ListPerPage = (typeof LIST_PER_PAGE)[number];
export const LIST_DEFAULT_PER_PAGE: ListPerPage = 25;
/** Longest name search; a longer one is ignored with a notice. */
export const LIST_SEARCH_MAX = 100;
/** The highest page number accepted from the address (a guard on the offset, not a data limit). */
export const LIST_MAX_PAGE = 10000;

export type SearchParams = Record<string, string | string[] | undefined>;
export type SortDir = "asc" | "desc";

const uuid = z.uuid();

/** The first value of a repeated parameter, or undefined; an empty string counts as absent. */
export function firstParam(params: SearchParams, key: string): string | undefined {
  const v = params[key];
  const value = Array.isArray(v) ? v[0] : v;
  return value === "" ? undefined : value;
}

/** A value from a fixed list, or undefined with the name added to `ignored` when it is not on the list. */
export function readOneOf<T extends string>(
  params: SearchParams,
  key: string,
  allowed: readonly T[],
  label: string,
  ignored: string[],
): T | undefined {
  const raw = firstParam(params, key);
  if (raw === undefined) return undefined;
  const found = allowed.find((a) => a === raw);
  if (found === undefined) ignored.push(label);
  return found;
}

/** A well-formed id (never checked against the database here: the read does that, in SQL). */
export function readUuid(
  params: SearchParams,
  key: string,
  label: string,
  ignored: string[],
): string | undefined {
  const raw = firstParam(params, key);
  if (raw === undefined) return undefined;
  if (uuid.safeParse(raw).success) return raw;
  ignored.push(label);
  return undefined;
}

/** The fields every list shares: the name search, the page, the page size and the leave date range. */
export type CommonQuery = {
  q: string | undefined;
  page: number;
  per: ListPerPage;
  /** Leave dates (inclusive): a request matches when its dates overlap this range. */
  from: string | undefined;
  to: string | undefined;
};

export function readCommon(params: SearchParams, ignored: string[]): CommonQuery {
  const out: CommonQuery = {
    q: undefined,
    page: 1,
    per: LIST_DEFAULT_PER_PAGE,
    from: undefined,
    to: undefined,
  };

  const rawQ = firstParam(params, "q")?.trim();
  if (rawQ) {
    if (rawQ.length > LIST_SEARCH_MAX) ignored.push("search");
    else out.q = rawQ;
  }

  const rawPage = firstParam(params, "page");
  if (rawPage !== undefined) {
    const n = Number(rawPage);
    if (Number.isInteger(n) && n >= 1 && n <= LIST_MAX_PAGE) out.page = n;
    else ignored.push("page");
  }

  const rawPer = firstParam(params, "per");
  if (rawPer !== undefined) {
    const found = LIST_PER_PAGE.find((p) => p === Number(rawPer));
    if (found) out.per = found;
    else ignored.push("rows per page");
  }

  for (const [key, label] of [
    ["from", "from date"],
    ["to", "to date"],
  ] as const) {
    const raw = firstParam(params, key);
    if (raw === undefined) continue;
    if (isRealIsoDate(raw)) out[key] = raw;
    else ignored.push(label);
  }
  if (out.from && out.to && out.to < out.from) {
    ignored.push("to date");
    out.to = undefined;
  }

  return out;
}

/** One page of a list, the true total before the cut, and the numbers for the tiles above it. */
export type ListPage<Row, Summary> = {
  /** Everything that matches the filters, which may be more than `rows`. */
  total: number;
  /** The page actually shown: a page past the end is clamped to the last one in SQL. */
  page: number;
  pageSize: number;
  rows: Row[];
  /** Counts for the whole scope (a team, the company): they ignore the search and the filters. */
  summary: Summary;
};

/** The page that was shown, given what was asked for and how many rows match. */
export const shownPage = (asked: number, total: number, per: number): number =>
  Math.min(asked, Math.max(1, Math.ceil(total / per)));
