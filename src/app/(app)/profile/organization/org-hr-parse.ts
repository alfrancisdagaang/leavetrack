import type { OrgNode } from "@/lib/leave/org";

/**
 * TASK-064 (EPIC-11). Reads the answer of `GET /api/org/children` in the browser without trusting it:
 * anything that is not exactly the documented envelope is `null`, which the tree shows as a failed
 * expansion. Pure.
 */
export type OrgPageResult = { total: number; page: number; pageSize: number; people: OrgNode[] };

const ROLES = new Set(["employee", "manager", "hr_admin"]);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

function parseNode(v: unknown): OrgNode | null {
  if (typeof v !== "object" || v === null) return null;
  const n = v as Record<string, unknown>;
  if (typeof n.id !== "string" || typeof n.name !== "string") return null;
  if (typeof n.role !== "string" || !ROLES.has(n.role)) return null;
  if (!isCount(n.reports)) return null;
  return { id: n.id, name: n.name, role: n.role as OrgNode["role"], reports: n.reports };
}

export function parseOrgPage(json: unknown): OrgPageResult | null {
  if (typeof json !== "object" || json === null) return null;
  const body = json as Record<string, unknown>;
  if (body.success !== true || typeof body.data !== "object" || body.data === null) return null;
  const d = body.data as Record<string, unknown>;
  if (!isCount(d.total) || !isCount(d.page) || d.page < 1 || !isCount(d.pageSize)) return null;
  if (!Array.isArray(d.people)) return null;
  const people: OrgNode[] = [];
  for (const raw of d.people) {
    const node = parseNode(raw);
    if (!node) return null;
    people.push(node);
  }
  return { total: d.total, page: d.page, pageSize: d.pageSize, people };
}
