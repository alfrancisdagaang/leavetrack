import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEAM_QUERY,
  parseTeamQueueQuery,
  TEAM_DECIDED_SORTS,
  TEAM_DECIDED_STATUSES,
  TEAM_PENDING_SORTS,
  TEAM_PENDING_STATUSES,
  teamDefaultDir,
} from "@/lib/leave/team-queue-schema";

const TYPE = "10000000-0000-4000-8000-000000000001";

describe("parseTeamQueueQuery", () => {
  it("defaults to the pending view, oldest request first, 25 a page", () => {
    expect(parseTeamQueueQuery({})).toEqual({ query: DEFAULT_TEAM_QUERY, ignored: [] });
    expect(DEFAULT_TEAM_QUERY).toMatchObject({
      view: "pending",
      sort: "created",
      dir: "asc",
      page: 1,
      per: 25,
      status: undefined,
    });
  });

  it("reads every filter of the pending view", () => {
    const r = parseTeamQueueQuery({
      q: "ana",
      type: TYPE,
      status: "over",
      from: "2026-11-02",
      to: "2026-11-30",
      sort: "days",
      per: "50",
      page: "2",
    });
    expect(r.ignored).toEqual([]);
    expect(r.query).toMatchObject({
      view: "pending",
      q: "ana",
      type: TYPE,
      status: "over",
      from: "2026-11-02",
      to: "2026-11-30",
      sort: "days",
      dir: "desc",
      per: 50,
      page: 2,
    });
  });

  it("the decided view starts with the latest decision first and has its own statuses and sorts", () => {
    const r = parseTeamQueueQuery({ view: "decided", status: "overridden", sort: "name" });
    expect(r.ignored).toEqual([]);
    expect(r.query).toMatchObject({
      view: "decided",
      status: "overridden",
      sort: "name",
      dir: "asc",
    });
    expect(parseTeamQueueQuery({ view: "decided" }).query).toMatchObject({
      sort: "decided",
      dir: "desc",
    });
  });

  it("a status or sort of the other view is ignored and named", () => {
    const a = parseTeamQueueQuery({ view: "decided", status: "over", sort: "days" });
    expect(a.ignored).toEqual(["status", "sort"]);
    expect(a.query).toMatchObject({ view: "decided", status: undefined, sort: "decided" });
    const b = parseTeamQueueQuery({ status: "approved", sort: "decided" });
    expect(b.ignored).toEqual(["status", "sort"]);
    expect(b.query).toMatchObject({ view: "pending", status: undefined, sort: "created" });
  });

  it.each([
    [{ view: "archive" }, "view"],
    [{ type: "nope" }, "leave type"],
    [{ dir: "up" }, "direction"],
    [{ sort: "email; drop table users" }, "sort"],
    [{ status: "' or 1=1" }, "status"],
  ])("ignores %j and names it", (params, name) => {
    const r = parseTeamQueueQuery(params);
    expect(r.ignored).toEqual([name]);
    expect(r.query).toEqual(DEFAULT_TEAM_QUERY);
  });

  it("a direction can reverse any sort", () => {
    expect(parseTeamQueueQuery({ sort: "created", dir: "desc" }).query.dir).toBe("desc");
    expect(parseTeamQueueQuery({ sort: "days", dir: "asc" }).query.dir).toBe("asc");
  });

  it("only the listed statuses and sorts exist, and each starts in the sensible direction", () => {
    expect(TEAM_PENDING_STATUSES).toEqual(["ok", "over", "blocked"]);
    expect(TEAM_DECIDED_STATUSES).toEqual(["approved", "rejected", "overridden"]);
    expect(TEAM_PENDING_SORTS).toEqual(["created", "start", "name", "days"]);
    expect(TEAM_DECIDED_SORTS).toEqual(["decided", "start", "name"]);
    expect(teamDefaultDir("created")).toBe("asc");
    expect(teamDefaultDir("name")).toBe("asc");
    expect(teamDefaultDir("days")).toBe("desc");
    expect(teamDefaultDir("decided")).toBe("desc");
  });
});
