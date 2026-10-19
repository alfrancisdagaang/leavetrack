import type { Sql } from "postgres";
import type { UserRole } from "@/lib/db/types";

/**
 * EPIC-11 (TASK-063). The organization chart's reads, built live from `users.manager_id` with no
 * cache, so a changed manager shows on the next load. Each read is ONE statement and takes the signed-in
 * user's id from the server session, never a value from the client. A node is the person's id, name,
 * role and how many people report to them, and nothing else: no email, no leave data.
 *
 * Scope is in the SQL (AGENTS.md rule 3):
 * - `getEmployeeOrg` is the viewer's own neighbourhood: their manager, themself, their direct reports.
 *   The manager row is found by the viewer's own `manager_id`, so a peer can never be selected.
 * - `getManagerOrg` starts at the viewer (who must be a `manager`) and walks DOWN `manager_id`.
 * - `getOrgChildren` / `getOrgRoots` are HR's, whose scope is the whole company (a documented exception to
 *   rule 3, like the override route and the company calendar): the viewer must be an `hr_admin` in the SQL,
 *   and the `parent` id the client sends is only a lookup key, never an identity.
 *
 * Nothing here writes. The schema only forbids managing yourself, so a longer loop (A manages B, B manages A)
 * can exist in the data: the recursive read carries the path walked and never visits a person twice.
 */

export const ORG_MAX_DEPTH = 6;
export const ORG_MANAGER_CAP = 200;
export const ORG_PAGE_SIZE = 50;

export type OrgNode = {
  id: string;
  name: string;
  role: UserRole;
  /** People whose manager is this person. */
  reports: number;
};

/** A person below the viewing manager: `depth` 1 is a direct report, `parentId` is their manager. */
export type OrgTreeNode = OrgNode & { parentId: string; depth: number };

export type EmployeeOrg = { manager: OrgNode | null; me: OrgNode; reports: OrgNode[] };

export type ManagerOrg = {
  manager: OrgNode | null;
  me: OrgNode;
  /** Everyone under the viewer to depth 6, shallowest first, at most 200. A parent always precedes its reports. */
  people: OrgTreeNode[];
  /** The true number of people under the viewer (within depth 6), however many `people` holds. */
  total: number;
  truncated: boolean;
};

export type OrgPage = { total: number; page: number; pageSize: number; people: OrgNode[] };

type EmployeeRow = { manager: OrgNode | null; me: OrgNode | null; reports: OrgNode[] };

/** The viewer, their manager and their direct reports. One statement. Null for an unknown viewer. */
export async function getEmployeeOrg(sql: Sql, viewerId: string): Promise<EmployeeOrg | null> {
  const [row] = await sql<EmployeeRow[]>`
    with me as (
      select u.id, u.name, u.role, u.manager_id
      from public.users u
      where u.id = ${viewerId}::uuid
    )
    select
      (select json_build_object(
                'id', m.id, 'name', m.name, 'role', m.role,
                'reports', (select count(*)::int from public.users c where c.manager_id = m.id))
       from me join public.users m on m.id = me.manager_id) as manager,
      (select json_build_object(
                'id', me.id, 'name', me.name, 'role', me.role,
                'reports', (select count(*)::int from public.users c where c.manager_id = me.id))
       from me) as me,
      coalesce((
        select json_agg(json_build_object(
                 'id', r.id, 'name', r.name, 'role', r.role,
                 'reports', (select count(*)::int from public.users c where c.manager_id = r.id))
               order by r.name, r.id)
        from me join public.users r on r.manager_id = me.id
      ), '[]'::json) as reports`;
  if (!row?.me) return null;
  return { manager: row.manager, me: row.me, reports: row.reports };
}

type ManagerRow = {
  manager: OrgNode | null;
  me: OrgNode | null;
  total: number;
  people: OrgTreeNode[];
};

/**
 * The viewing manager, their own manager and everyone under them, one statement. Null unless the viewer
 * is a `manager`. The walk stops at depth 6 and never revisits a person (the `path` array starts with the
 * viewer, so a loop back to the viewer ends too). Shallowest people come first and the cut is made by
 * that order, so the people returned always include each person's manager. The total counts everyone
 * the walk reached before the cut of 200.
 */
export async function getManagerOrg(sql: Sql, viewerId: string): Promise<ManagerOrg | null> {
  const [row] = await sql<ManagerRow[]>`
    with recursive viewer as (
      select u.id, u.name, u.role, u.manager_id
      from public.users u
      where u.id = ${viewerId}::uuid and u.role = 'manager'
    ),
    tree as (
      select u.id, u.name, u.role, u.manager_id as parent_id, 1 as depth, array[v.id, u.id] as path
      from viewer v
      join public.users u on u.manager_id = v.id
      union all
      select u.id, u.name, u.role, u.manager_id, t.depth + 1, t.path || u.id
      from tree t
      join public.users u on u.manager_id = t.id
      where t.depth < ${ORG_MAX_DEPTH}::int and not (u.id = any (t.path))
    ),
    counted as (select count(*)::int as total from tree),
    kept as (
      select * from tree order by depth, name, id limit ${ORG_MANAGER_CAP}::int
    )
    select
      (select json_build_object(
                'id', v.id, 'name', v.name, 'role', v.role,
                'reports', (select count(*)::int from public.users c where c.manager_id = v.id))
       from viewer v) as me,
      (select json_build_object(
                'id', m.id, 'name', m.name, 'role', m.role,
                'reports', (select count(*)::int from public.users c where c.manager_id = m.id))
       from viewer v join public.users m on m.id = v.manager_id) as manager,
      (select total from counted) as total,
      coalesce((
        select json_agg(json_build_object(
                 'id', k.id, 'name', k.name, 'role', k.role, 'parentId', k.parent_id,
                 'depth', k.depth,
                 'reports', (select count(*)::int from public.users c where c.manager_id = k.id))
               order by k.depth, k.name, k.id)
        from kept k
      ), '[]'::json) as people`;
  if (!row?.me) return null;
  return {
    manager: row.manager,
    me: row.me,
    people: row.people,
    total: row.total,
    truncated: row.total > row.people.length,
  };
}

type PageRaw = { total: number; people: OrgNode[] };

/**
 * HR only: one page (50) of a person's direct reports, or, with `parentId` null, of the top of the company
 * (people with no manager), each with how many people report to them. Name order, the page clamped in
 * SQL so one past the end shows the last page. One statement. Anyone who is not an `hr_admin`, and any
 * unknown parent, gets an empty page: the answer never says whether a person exists.
 */
export async function getOrgChildren(
  sql: Sql,
  { viewerId, parentId, page }: { viewerId: string; parentId: string | null; page: number },
): Promise<OrgPage> {
  const asked = (page - 1) * ORG_PAGE_SIZE;
  const [raw] = await sql<PageRaw[]>`
    with f as (
      select u.id, u.name, u.role
      from public.users u
      where exists (select 1 from public.users h where h.id = ${viewerId}::uuid and h.role = 'hr_admin')
        and ((${parentId}::uuid is null and u.manager_id is null) or u.manager_id = ${parentId}::uuid)
    ),
    counts as (select count(*)::int as total from f),
    kept as (
      select f.* from f
      order by f.name, f.id
      offset (select least(${asked}::int,
                           greatest(0, (ceil(total / ${ORG_PAGE_SIZE}::numeric)::int - 1)
                                       * ${ORG_PAGE_SIZE}::int))
              from counts)
      limit ${ORG_PAGE_SIZE}::int
    )
    select c.total,
           coalesce((
             select json_agg(json_build_object(
                      'id', k.id, 'name', k.name, 'role', k.role,
                      'reports', (select count(*)::int from public.users x where x.manager_id = k.id))
                    order by k.name, k.id)
             from kept k
           ), '[]'::json) as people
    from counts c`;

  if (!raw) throw new Error("The organization page read returned no row.");
  const pages = Math.max(1, Math.ceil(raw.total / ORG_PAGE_SIZE));
  return {
    total: raw.total,
    page: Math.min(page, pages),
    pageSize: ORG_PAGE_SIZE,
    people: raw.people,
  };
}

/** HR's starting point: the people at the top of the company. The same statement as `getOrgChildren`. */
export function getOrgRoots(
  sql: Sql,
  { viewerId, page = 1 }: { viewerId: string; page?: number },
): Promise<OrgPage> {
  return getOrgChildren(sql, { viewerId, parentId: null, page });
}
