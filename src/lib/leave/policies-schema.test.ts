import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY_QUERY,
  defaultDir,
  parsePolicyQuery,
  POLICY_PER_PAGE,
  POLICY_RATE_MAX,
  POLICY_SEARCH_MAX,
  POLICY_SORTS,
  POLICY_STATUSES,
  rateText,
  setPolicyRateSchema,
} from "@/lib/leave/policies-schema";

const U = "00000000-0000-4000-8000-000000000003";
const T = "10000000-0000-4000-8000-000000000001";
const body = (accrual_per_month: unknown) => ({ user_id: U, leave_type_id: T, accrual_per_month });
const messages = (input: unknown) => {
  const r = setPolicyRateSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("setPolicyRateSchema (TASK-071 AC4)", () => {
  it.each([0, 0.01, 1.25, 1.5, 2, 30.99, 31])("accepts %s days a month", (n) => {
    expect(setPolicyRateSchema.safeParse(body(n)).success).toBe(true);
  });

  it.each([
    [-0.01, "cannot be negative"],
    [31.01, "more than 31"],
    [32, "more than 31"],
    [1.255, "at most two decimals"],
    [0.001, "at most two decimals"],
  ])("rejects %s", (n, text) => {
    expect(messages(body(n))[0]).toContain(text);
  });

  it.each([["1.25"], [null], [undefined], [Number.NaN], [Number.POSITIVE_INFINITY], [true]])(
    "rejects a non-number: %j",
    (n) => {
      expect(setPolicyRateSchema.safeParse(body(n)).success).toBe(false);
    },
  );

  it("rejects a missing or malformed id", () => {
    expect(setPolicyRateSchema.safeParse({ ...body(1), user_id: "nope" }).success).toBe(false);
    expect(setPolicyRateSchema.safeParse({ ...body(1), leave_type_id: undefined }).success).toBe(
      false,
    );
    expect(setPolicyRateSchema.safeParse(null).success).toBe(false);
  });

  it("ignores any extra field, such as a client-supplied actor", () => {
    const parsed = setPolicyRateSchema.parse({ ...body(1), changed_by: "x", actor: "y" });
    expect(Object.keys(parsed).sort()).toEqual(["accrual_per_month", "leave_type_id", "user_id"]);
  });

  it("the largest rate matches the database CHECK in the migration", () => {
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20261020120000_leave_policy_changes.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(sql).toContain(`new_rate <= ${POLICY_RATE_MAX}`);
  });
});

describe("rateText", () => {
  it("writes the fixed two-decimal text the database stores", () => {
    expect(rateText(1.5)).toBe("1.50");
    expect(rateText(0)).toBe("0.00");
    expect(rateText(31)).toBe("31.00");
    expect(rateText(1.25)).toBe("1.25");
  });
});

const TEAM = "00000000-0000-4000-8000-000000000002";
const TYPE = "10000000-0000-4000-8000-000000000001";

describe("parsePolicyQuery", () => {
  it("defaults: page 1, 25 a page, name A to Z, no search and no filter", () => {
    expect(parsePolicyQuery({})).toEqual({ query: DEFAULT_POLICY_QUERY, ignored: [] });
    expect(DEFAULT_POLICY_QUERY).toMatchObject({ per: 25, sort: "name", dir: "asc", page: 1 });
  });

  it("reads a trimmed search and a page, first value of a repeated parameter", () => {
    expect(parsePolicyQuery({ q: "  ana  ", page: "3" }).query).toMatchObject({
      q: "ana",
      page: 3,
    });
    expect(parsePolicyQuery({ q: ["a", "b"], page: ["2", "9"] }).query).toMatchObject({
      q: "a",
      page: 2,
    });
  });

  it("reads the page size, sort, direction, team, leave type and status", () => {
    const r = parsePolicyQuery({
      per: "50",
      sort: "vacation",
      dir: "desc",
      team: TEAM,
      type: TYPE,
      status: "none",
    });
    expect(r.ignored).toEqual([]);
    expect(r.query).toMatchObject({
      per: 50,
      sort: "vacation",
      dir: "desc",
      team: TEAM,
      type: TYPE,
      status: "none",
    });
  });

  it("a sort without a direction starts newest first for 'changed' and ascending otherwise", () => {
    expect(parsePolicyQuery({ sort: "changed" }).query.dir).toBe("desc");
    expect(parsePolicyQuery({ sort: "sick" }).query.dir).toBe("asc");
    expect(parsePolicyQuery({ sort: "changed", dir: "asc" }).query.dir).toBe("asc");
  });

  it.each([
    [{ per: "30" }, "rows per page"],
    [{ per: "abc" }, "rows per page"],
    [{ sort: "email" }, "sort"],
    [{ sort: "name; drop table users" }, "sort"],
    [{ dir: "up" }, "direction"],
    [{ team: "not-a-uuid" }, "team"],
    [{ type: "1" }, "leave type"],
    [{ status: "cancelled" }, "status"],
  ])("ignores %j and names it", (params, name) => {
    const r = parsePolicyQuery(params);
    expect(r.ignored).toEqual([name]);
    expect(r.query).toEqual(DEFAULT_POLICY_QUERY);
  });

  it("ignores and names a search that is too long and a bad page, never failing", () => {
    const r = parsePolicyQuery({ q: "x".repeat(POLICY_SEARCH_MAX + 1), page: "0" });
    expect(r.query).toEqual(DEFAULT_POLICY_QUERY);
    expect(r.ignored).toEqual(["search", "page"]);
    for (const bad of ["abc", "1.5", "-2", "10001"])
      expect(parsePolicyQuery({ page: bad }).ignored).toEqual(["page"]);
  });

  it("an empty search is no search", () => {
    expect(parsePolicyQuery({ q: "   " }).query.q).toBeUndefined();
  });

  it("only the listed sorts, page sizes and statuses exist", () => {
    expect(POLICY_SORTS).toEqual(["name", "vacation", "sick", "changed"]);
    expect(POLICY_PER_PAGE).toEqual([25, 50, 100]);
    expect(POLICY_STATUSES).toEqual(["none", "has", "changed"]);
    expect(defaultDir("name")).toBe("asc");
  });
});
