import { describe, expect, it } from "vitest";
import type { OrgTreeNode } from "@/lib/leave/org";
import { buildTree, MAX_INDENT_DEPTH, nestClass } from "./org-tree-build";

const p = (
  id: string,
  parentId: string,
  depth: number,
  reports = 0,
  name = id.toUpperCase(),
): OrgTreeNode => ({ id, name, role: "employee", reports, parentId, depth });

describe("buildTree (TASK-064)", () => {
  it("nests people under their manager and keeps the input order", () => {
    const tree = buildTree(
      [p("a", "root", 1, 2), p("b", "root", 1), p("c", "a", 2), p("d", "a", 2)],
      "root",
    );
    expect(tree.map((n) => n.id)).toEqual(["a", "b"]);
    expect(tree[0]!.children.map((n) => n.id)).toEqual(["c", "d"]);
    expect(tree[1]!.children).toEqual([]);
  });

  it("is empty for a manager with nobody under them", () => {
    expect(buildTree([], "root")).toEqual([]);
  });

  it("counts reports that are not in the list as hidden (the depth cap, or the cut at 200)", () => {
    const tree = buildTree([p("a", "root", 1, 3), p("c", "a", 2)], "root");
    expect(tree[0]!.hidden).toBe(2); // 3 reports, 1 loaded
    expect(tree[0]!.children[0]!.hidden).toBe(0);
    const leaf = buildTree([p("z", "root", 6, 5)], "root")[0]!;
    expect(leaf.hidden).toBe(5);
  });

  it("never reports a negative hidden count", () => {
    const tree = buildTree([p("a", "root", 1, 0), p("c", "a", 2)], "root");
    expect(tree[0]!.hidden).toBe(0);
  });

  it("leaves out a person whose manager is not in the list (a malformed list), instead of throwing", () => {
    expect(buildTree([p("a", "missing", 2)], "root")).toEqual([]);
  });

  it("keeps the depth each person was given", () => {
    const tree = buildTree([p("a", "root", 1, 1), p("b", "a", 2, 1), p("c", "b", 3)], "root");
    expect(tree[0]!.children[0]!.children[0]!.depth).toBe(3);
  });
});

describe("nestClass (TASK-064 AC4)", () => {
  it("indents levels 2 and 3 and stops there, so a deep tree cannot widen the page", () => {
    expect(MAX_INDENT_DEPTH).toBe(3);
    for (const depth of [2, 3]) expect(nestClass(depth)).toContain("ml-3");
    for (const depth of [4, 5, 6]) {
      expect(nestClass(depth)).not.toContain("ml-3");
      expect(nestClass(depth)).toContain("pl-0");
    }
  });

  it("keeps the rule line at every level so the nesting stays visible", () => {
    for (const depth of [2, 3, 4, 6]) expect(nestClass(depth)).toContain("border-l");
  });
});
