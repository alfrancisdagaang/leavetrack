import { describe, expect, it } from "vitest";
import { ORG_PAGE_SIZE, type OrgNode } from "@/lib/leave/org";
import {
  hasMore,
  initialOrgHrState,
  nextPage,
  nodeOf,
  orgHrReducer,
  type OrgHrAction,
  type OrgHrState,
} from "./org-hr-state";

const person = (id: string, reports = 0): OrgNode => ({
  id,
  name: `P ${id}`,
  role: "employee",
  reports,
});
const run = (actions: OrgHrAction[], from: OrgHrState = initialOrgHrState) =>
  actions.reduce(orgHrReducer, from);
const loaded = (id: string, ticket: number, page: number, total: number, people: OrgNode[]) =>
  ({ type: "loaded", id, ticket, page, total, people }) as const;

describe("orgHrReducer (TASK-064)", () => {
  it("starts with everything closed and nothing loaded", () => {
    const n = nodeOf(initialOrgHrState, "x");
    expect(n).toMatchObject({ open: false, status: "idle", people: [], page: 0, total: 0 });
    expect(nextPage(n)).toBe(1);
    expect(hasMore(n)).toBe(false);
  });

  it("a request opens the person and shows it is loading; the answer fills it in", () => {
    const loading = run([{ type: "request", id: "a", ticket: 1 }]);
    expect(nodeOf(loading, "a")).toMatchObject({ open: true, status: "loading" });
    const done = run([loaded("a", 1, 1, 2, [person("x"), person("y")])], loading);
    expect(nodeOf(done, "a")).toMatchObject({ status: "ready", page: 1, total: 2 });
    expect(nodeOf(done, "a").people.map((p) => p.id)).toEqual(["x", "y"]);
    expect(hasMore(nodeOf(done, "a"))).toBe(false);
  });

  it("offers more only while pages remain, and asks for the next page", () => {
    const first = Array.from({ length: ORG_PAGE_SIZE }, (_, i) => person(`p${i}`));
    const s = run([{ type: "request", id: "a", ticket: 1 }, loaded("a", 1, 1, 55, first)]);
    expect(hasMore(nodeOf(s, "a"))).toBe(true);
    expect(nextPage(nodeOf(s, "a"))).toBe(2);
    const s2 = run(
      [
        { type: "request", id: "a", ticket: 2 },
        loaded("a", 2, 2, 55, [person("q1"), person("q2")]),
      ],
      s,
    );
    expect(nodeOf(s2, "a").people).toHaveLength(52);
    expect(hasMore(nodeOf(s2, "a"))).toBe(false);
  });

  it("shows each person once when a page repeats someone (the data moved between pages)", () => {
    const s = run([
      { type: "request", id: "a", ticket: 1 },
      loaded("a", 1, 1, 60, [person("x"), person("y")]),
      { type: "request", id: "a", ticket: 2 },
      loaded("a", 2, 2, 60, [person("y"), person("z")]),
    ]);
    expect(nodeOf(s, "a").people.map((p) => p.id)).toEqual(["x", "y", "z"]);
  });

  it("an answer for an older request is ignored (a slow answer cannot overwrite a newer one)", () => {
    const s = run([
      { type: "request", id: "a", ticket: 1 },
      { type: "request", id: "a", ticket: 2 },
    ]);
    const stale = orgHrReducer(s, loaded("a", 1, 1, 1, [person("old")]));
    expect(stale).toBe(s);
    expect(nodeOf(stale, "a").status).toBe("loading");
    const staleFail = orgHrReducer(s, { type: "failed", id: "a", ticket: 1 });
    expect(staleFail).toBe(s);
    const fresh = orgHrReducer(s, loaded("a", 2, 1, 1, [person("new")]));
    expect(nodeOf(fresh, "a").people.map((p) => p.id)).toEqual(["new"]);
  });

  it("a failure keeps what was loaded and asks for the same page again", () => {
    const s = run([
      { type: "request", id: "a", ticket: 1 },
      loaded(
        "a",
        1,
        1,
        90,
        Array.from({ length: 50 }, (_, i) => person(`p${i}`)),
      ),
      { type: "request", id: "a", ticket: 2 },
      { type: "failed", id: "a", ticket: 2 },
    ]);
    expect(nodeOf(s, "a").status).toBe("error");
    expect(nodeOf(s, "a").people).toHaveLength(50);
    expect(nextPage(nodeOf(s, "a"))).toBe(2);
  });

  it("collapsing keeps what was loaded, and opening again needs no new read", () => {
    const s = run([
      { type: "request", id: "a", ticket: 1 },
      loaded("a", 1, 1, 1, [person("x")]),
      { type: "collapse", id: "a" },
    ]);
    expect(nodeOf(s, "a")).toMatchObject({ open: false, status: "ready" });
    const reopened = orgHrReducer(s, { type: "open", id: "a" });
    expect(nodeOf(reopened, "a")).toMatchObject({ open: true, status: "ready" });
    expect(nodeOf(reopened, "a").people).toHaveLength(1);
  });

  it("keeps people apart: loading one person does not touch another", () => {
    const s = run([
      { type: "request", id: "a", ticket: 1 },
      loaded("a", 1, 1, 1, [person("x")]),
      { type: "request", id: "b", ticket: 2 },
    ]);
    expect(nodeOf(s, "a").status).toBe("ready");
    expect(nodeOf(s, "b").status).toBe("loading");
  });

  it("after Show more, focus goes to the first NEW person; the first page does not steal focus", () => {
    const first = run([
      { type: "request", id: "a", ticket: 1 },
      loaded(
        "a",
        1,
        1,
        52,
        Array.from({ length: 50 }, (_, i) => person(`p${i}`)),
      ),
    ]);
    expect(first.focusId).toBeNull();
    const more = run(
      [
        { type: "request", id: "a", ticket: 2 },
        loaded("a", 2, 2, 52, [person("n1"), person("n2")]),
      ],
      first,
    );
    expect(more.focusId).toBe("n1");
    expect(orgHrReducer(more, { type: "focus_done" }).focusId).toBeNull();
  });

  it("a repeat page with nobody new does not move focus", () => {
    const s = run([
      { type: "request", id: "a", ticket: 1 },
      loaded("a", 1, 1, 60, [person("x")]),
      { type: "request", id: "a", ticket: 2 },
      loaded("a", 2, 2, 60, [person("x")]),
    ]);
    expect(s.focusId).toBeNull();
  });
});
