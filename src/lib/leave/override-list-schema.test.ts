import { describe, expect, it } from "vitest";
import {
  DEFAULT_OVERRIDE_QUERY,
  OVERRIDE_DONE_SORTS,
  OVERRIDE_WAITING_SORTS,
  overrideDefaultDir,
  parseOverrideListQuery,
} from "@/lib/leave/override-list-schema";

const TYPE = "10000000-0000-4000-8000-000000000001";
const TEAM = "00000000-0000-4000-8000-000000000002";

describe("parseOverrideListQuery", () => {
  it("defaults to the waiting view, oldest request first, 25 a page", () => {
    expect(parseOverrideListQuery({})).toEqual({ query: DEFAULT_OVERRIDE_QUERY, ignored: [] });
    expect(DEFAULT_OVERRIDE_QUERY).toMatchObject({
      view: "waiting",
      sort: "created",
      dir: "asc",
      per: 25,
    });
  });

  it("reads every filter, including the team", () => {
    const r = parseOverrideListQuery({
      q: "ana",
      type: TYPE,
      team: TEAM,
      from: "2026-11-02",
      to: "2026-11-30",
      sort: "shortfall",
      per: "100",
      page: "3",
    });
    expect(r.ignored).toEqual([]);
    expect(r.query).toMatchObject({
      q: "ana",
      type: TYPE,
      team: TEAM,
      sort: "shortfall",
      dir: "desc",
      per: 100,
      page: 3,
    });
  });

  it("the overridden view starts with the latest approval first and has its own sorts", () => {
    expect(parseOverrideListQuery({ view: "overridden" }).query).toMatchObject({
      view: "overridden",
      sort: "approved",
      dir: "desc",
    });
    expect(parseOverrideListQuery({ view: "overridden", sort: "shortfall" }).ignored).toEqual([]);
  });

  it("a sort of the other view is ignored and named", () => {
    const a = parseOverrideListQuery({ view: "overridden", sort: "days" });
    expect(a.ignored).toEqual(["sort"]);
    expect(a.query.sort).toBe("approved");
    const b = parseOverrideListQuery({ sort: "approved" });
    expect(b.ignored).toEqual(["sort"]);
    expect(b.query.sort).toBe("created");
  });

  it.each([
    [{ view: "all" }, "view"],
    [{ type: "x" }, "leave type"],
    [{ team: "x" }, "team"],
    [{ dir: "up" }, "direction"],
    [{ sort: "balance" }, "sort"],
  ])("ignores %j and names it", (params, name) => {
    const r = parseOverrideListQuery(params);
    expect(r.ignored).toEqual([name]);
    expect(r.query).toEqual(DEFAULT_OVERRIDE_QUERY);
  });

  it("only the listed sorts exist, each starting in the sensible direction", () => {
    expect(OVERRIDE_WAITING_SORTS).toEqual(["created", "start", "name", "shortfall", "days"]);
    expect(OVERRIDE_DONE_SORTS).toEqual(["approved", "shortfall", "name", "start"]);
    expect(overrideDefaultDir("created")).toBe("asc");
    expect(overrideDefaultDir("shortfall")).toBe("desc");
    expect(overrideDefaultDir("approved")).toBe("desc");
    expect(overrideDefaultDir("name")).toBe("asc");
  });
});
