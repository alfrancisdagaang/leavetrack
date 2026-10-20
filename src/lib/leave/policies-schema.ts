import { z } from "zod";

/** Most days a month a policy may accrue. Mirrors the CHECK in leave_policy_changes (a test pins both). */
export const POLICY_RATE_MAX = 31;
/** Employees per page when the address does not say. */
export const POLICY_PAGE_SIZE = 25;
/** The page sizes HR may choose. */
export const POLICY_PER_PAGE = [25, 50, 100] as const;
/** Longest name search; a longer one is ignored with a notice. */
export const POLICY_SEARCH_MAX = 100;
/** What the list can be ordered by. `vacation` and `sick` are the rates of the leave types of those names. */
export const POLICY_SORTS = ["name", "vacation", "sick", "changed"] as const;
export const POLICY_STATUSES = ["none", "has", "changed"] as const;

export type PolicyPerPage = (typeof POLICY_PER_PAGE)[number];
export type PolicySort = (typeof POLICY_SORTS)[number];
export type PolicyDir = "asc" | "desc";
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

/** A number of days with at most two decimals (the column is numeric(6, 2)). */
const rate = z
  .number()
  .finite()
  .min(0, "The rate cannot be negative.")
  .max(POLICY_RATE_MAX, `The rate cannot be more than ${POLICY_RATE_MAX} days a month.`)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9, "Use at most two decimals.");

/**
 * Body of `PUT /api/leave-policies` (EPIC-13): one employee, one leave type, the new accrual rate in
 * days a month. Both ids are lookup keys, never an identity: the actor is always the session user.
 */
export const setPolicyRateSchema = z.object({
  user_id: z.uuid(),
  leave_type_id: z.uuid(),
  accrual_per_month: rate,
});

export type SetPolicyRateInput = z.infer<typeof setPolicyRateSchema>;

/** The rate as the fixed two-decimal text the database stores ("1.5" becomes "1.50"). */
export function rateText(n: number): string {
  return n.toFixed(2);
}

/** What the page asks the list read for: a search, a page, an order and the filters. */
export type PolicyListQuery = {
  q: string | undefined;
  page: number;
  per: PolicyPerPage;
  sort: PolicySort;
  dir: PolicyDir;
  /** Only employees whose manager is this person. */
  team: string | undefined;
  /** Only this leave type's rate is shown, and "no policy" means missing this type. */
  type: string | undefined;
  status: PolicyStatus | undefined;
};

export const DEFAULT_POLICY_QUERY: PolicyListQuery = {
  q: undefined,
  page: 1,
  per: POLICY_PAGE_SIZE,
  sort: "name",
  dir: "asc",
  team: undefined,
  type: undefined,
  status: undefined,
};

/** The direction a sort starts in: newest first for "last changed", A to Z or lowest first otherwise. */
export const defaultDir = (sort: PolicySort): PolicyDir => (sort === "changed" ? "desc" : "asc");

type SearchParams = Record<string, string | string[] | undefined>;

const uuid = z.uuid();

/**
 * The page's address: a name search, page, rows per page, sort and direction, team, leave type and
 * status. A bad value is ignored, never an error, and named in `ignored` so the page can say so. A
 * repeated parameter uses its first value. The sort is one of a fixed list (it is never put into SQL
 * as text; the read chooses its ordering from these values).
 */
export function parsePolicyQuery(params: SearchParams): {
  query: PolicyListQuery;
  ignored: string[];
} {
  const first = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const ignored: string[] = [];
  const query: PolicyListQuery = { ...DEFAULT_POLICY_QUERY };

  const rawQ = first("q")?.trim();
  if (rawQ) {
    if (rawQ.length > POLICY_SEARCH_MAX) ignored.push("search");
    else query.q = rawQ;
  }

  const rawPage = first("page");
  if (rawPage !== undefined && rawPage !== "") {
    const n = Number(rawPage);
    if (Number.isInteger(n) && n >= 1 && n <= 10000) query.page = n;
    else ignored.push("page");
  }

  const rawPer = first("per");
  if (rawPer !== undefined && rawPer !== "") {
    const n = Number(rawPer);
    const found = POLICY_PER_PAGE.find((p) => p === n);
    if (found) query.per = found;
    else ignored.push("rows per page");
  }

  const rawSort = first("sort");
  if (rawSort !== undefined && rawSort !== "") {
    const found = POLICY_SORTS.find((s) => s === rawSort);
    if (found) query.sort = found;
    else ignored.push("sort");
  }
  query.dir = defaultDir(query.sort);
  const rawDir = first("dir");
  if (rawDir !== undefined && rawDir !== "") {
    if (rawDir === "asc" || rawDir === "desc") query.dir = rawDir;
    else ignored.push("direction");
  }

  for (const [key, label] of [
    ["team", "team"],
    ["type", "leave type"],
  ] as const) {
    const raw = first(key);
    if (raw === undefined || raw === "") continue;
    if (uuid.safeParse(raw).success) query[key] = raw;
    else ignored.push(label);
  }

  const rawStatus = first("status");
  if (rawStatus !== undefined && rawStatus !== "") {
    const found = POLICY_STATUSES.find((s) => s === rawStatus);
    if (found) query.status = found;
    else ignored.push("status");
  }

  return { query, ignored };
}
