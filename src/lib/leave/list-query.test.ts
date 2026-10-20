import { describe, expect, it } from "vitest";
import {
  firstParam,
  LIST_MAX_PAGE,
  LIST_PER_PAGE,
  LIST_SEARCH_MAX,
  readCommon,
  readOneOf,
  readUuid,
} from "@/lib/leave/list-query";

const ID = "00000000-0000-4000-8000-000000000002";

describe("firstParam", () => {
  it("takes the first of a repeated parameter and treats an empty one as absent", () => {
    expect(firstParam({ a: ["x", "y"] }, "a")).toBe("x");
    expect(firstParam({ a: "" }, "a")).toBeUndefined();
    expect(firstParam({}, "a")).toBeUndefined();
  });
});

describe("readOneOf and readUuid", () => {
  it("accept a listed value and name an unlisted one", () => {
    const ignored: string[] = [];
    expect(readOneOf({ s: "a" }, "s", ["a", "b"] as const, "sort", ignored)).toBe("a");
    expect(readOneOf({ s: "c" }, "s", ["a", "b"] as const, "sort", ignored)).toBeUndefined();
    expect(readOneOf({}, "s", ["a", "b"] as const, "sort", ignored)).toBeUndefined();
    expect(ignored).toEqual(["sort"]);
  });

  it("a uuid is accepted, anything else is named", () => {
    const ignored: string[] = [];
    expect(readUuid({ t: ID }, "t", "team", ignored)).toBe(ID);
    expect(readUuid({ t: "nope" }, "t", "team", ignored)).toBeUndefined();
    expect(readUuid({ t: "1' or '1'='1" }, "t", "team", ignored)).toBeUndefined();
    expect(ignored).toEqual(["team", "team"]);
  });
});

describe("readCommon", () => {
  it("defaults: no search, page 1, 25 a page, no dates", () => {
    const ignored: string[] = [];
    expect(readCommon({}, ignored)).toEqual({
      q: undefined,
      page: 1,
      per: 25,
      from: undefined,
      to: undefined,
    });
    expect(ignored).toEqual([]);
  });

  it("reads a trimmed search, a page, a page size and a date range", () => {
    const ignored: string[] = [];
    expect(
      readCommon(
        { q: "  ana ", page: "3", per: "100", from: "2026-11-02", to: "2026-11-30" },
        ignored,
      ),
    ).toEqual({ q: "ana", page: 3, per: 100, from: "2026-11-02", to: "2026-11-30" });
    expect(ignored).toEqual([]);
    expect(LIST_PER_PAGE).toEqual([25, 50, 100]);
  });

  it.each([
    [{ q: "x".repeat(LIST_SEARCH_MAX + 1) }, "search"],
    [{ page: "0" }, "page"],
    [{ page: "abc" }, "page"],
    [{ page: String(LIST_MAX_PAGE + 1) }, "page"],
    [{ per: "30" }, "rows per page"],
    [{ from: "2026-02-30" }, "from date"],
    [{ to: "tomorrow" }, "to date"],
  ])("ignores %j and names it", (params, name) => {
    const ignored: string[] = [];
    const out = readCommon(params, ignored);
    expect(ignored).toEqual([name]);
    expect(out).toMatchObject({ q: undefined, page: 1, per: 25, from: undefined, to: undefined });
  });

  it("a range that ends before it starts keeps the start and drops the end", () => {
    const ignored: string[] = [];
    const out = readCommon({ from: "2026-11-10", to: "2026-11-02" }, ignored);
    expect(out.from).toBe("2026-11-10");
    expect(out.to).toBeUndefined();
    expect(ignored).toEqual(["to date"]);
  });

  it("the same day for both ends is a one-day range", () => {
    const out = readCommon({ from: "2026-11-02", to: "2026-11-02" }, []);
    expect(out).toMatchObject({ from: "2026-11-02", to: "2026-11-02" });
  });
});
