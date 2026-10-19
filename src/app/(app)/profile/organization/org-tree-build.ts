import type { OrgNode, OrgTreeNode } from "@/lib/leave/org";

/**
 * TASK-064 (EPIC-11). Turns the flat list `getManagerOrg` returns (shallowest first, each person with
 * their `parentId`) into a nested tree for the page. Pure.
 */
export type TreeNode = OrgNode & {
  depth: number;
  children: TreeNode[];
  /** Reports this person has that are not in `children` (the depth cap, or the cut at 200). */
  hidden: number;
};

/**
 * `rootId` is the viewing manager: people whose `parentId` is the root are the top level. The input
 * order is kept, so siblings stay in name order. A person whose parent is not in the list is left
 * out: the read cuts shallowest-first, so a parent is always kept before its reports and this only
 * guards against a malformed list.
 */
export function buildTree(people: readonly OrgTreeNode[], rootId: string): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  const top: TreeNode[] = [];
  for (const p of people) {
    const node: TreeNode = {
      id: p.id,
      name: p.name,
      role: p.role,
      reports: p.reports,
      depth: p.depth,
      children: [],
      hidden: 0,
    };
    byId.set(p.id, node);
    if (p.parentId === rootId) top.push(node);
    else byId.get(p.parentId)?.children.push(node);
  }
  for (const node of byId.values()) node.hidden = Math.max(0, node.reports - node.children.length);
  return top;
}

/** The deepest level that is indented. Deeper levels share its indent, so a six-level tree cannot widen the page. */
export const MAX_INDENT_DEPTH = 3;

/**
 * Classes of the list that holds the people at `depth` (2 and deeper sit under a person). A small
 * step up to `MAX_INDENT_DEPTH`, then none: the rule line stays so the nesting is still visible.
 */
export function nestClass(depth: number): string {
  return depth <= MAX_INDENT_DEPTH ? "ml-3 border-l border-line pl-3" : "border-l border-line pl-0";
}
