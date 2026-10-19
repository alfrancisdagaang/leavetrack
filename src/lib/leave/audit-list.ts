import type { Sql } from "postgres";
import type { LeaveStatus, UserRole } from "@/lib/db/types";
import { AUDIT_PAGE_SIZE, type AuditListQuery } from "@/lib/leave/schemas";
import { countWorkingDays } from "@/lib/leave/working-days";

/**
 * US-14 (US-05, BR-04). HR's read-only audit list across all employees. The role gate (hr_admin) is
 * applied by the caller; HR may open any employee, so there is no per-person scope here. This module
 * only reads: no insert, update or delete, and never the employee's free-text `reason` (it can hold
 * medical details and the compliance record does not need it). The decision note is a manager's own
 * words and is not selected here either: it belongs to the single-request record.
 */

export type AuditListRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: UserRole;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  status: LeaveStatus;
  /** A soft-deleted request: shown as removed, whatever its status was. */
  isDeleted: boolean;
  decidedByName: string | null;
  decidedByRole: UserRole | null;
  /** ISO timestamp, or null while pending. */
  decidedAt: string | null;
  createdAt: string;
  /** True when HR approved it as an override (an `override_approved` audit row exists). */
  overridden: boolean;
};

/** Every request matching the filters (not only this page), split so the buckets add up to `total`. */
export type AuditCounts = {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  deleted: number;
};

export type AuditListPage = {
  counts: AuditCounts;
  rows: AuditListRow[];
  /** The page shown: the one asked for, or the last one when it is past the end. */
  page: number;
};

type RawRow = Omit<AuditListRow, "workingDays">;
type Raw = AuditCounts & { rows: RawRow[] };

/** `%` and `_` are wildcards in `ilike` and `\` escapes them: a typed name is matched literally. */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, "\\$&")}%`;
}

export async function getAuditPage(sql: Sql, query: AuditListQuery): Promise<AuditListPage> {
  const pattern = query.q ? likePattern(query.q) : null;
  const type = query.leaveTypeId ?? null;
  const status = query.status ?? null;
  const by = query.decidedBy ?? null;
  const from = query.from ?? null;
  const to = query.to ?? null;
  const asked = (query.page - 1) * AUDIT_PAGE_SIZE;

  // One statement: the matching set, its bucket counts, and the page of rows. A request is in exactly
  // one bucket (deleted first, then its status), so the counts always add up. A date range matches when
  // ANY audit event of the request falls inside it; the bounds are UTC midnights, so the session time
  // zone cannot move a day. The offset is clamped in SQL so a page past the end shows the last page.
  const [raw] = await sql<Raw[]>`
    with f as (
      select r.id, r.user_id, r.leave_type_id, r.start_date, r.end_date, r.status, r.is_deleted,
             r.decided_by, r.decided_at, r.created_at,
             case when r.is_deleted then 'deleted' else r.status::text end as bucket
      from public.leave_requests r
      join public.users u on u.id = r.user_id
      where (${pattern}::text is null or u.name ilike ${pattern})
        and (${type}::uuid is null or r.leave_type_id = ${type})
        and (${by}::uuid is null or r.decided_by = ${by})
        and (${status}::text is null
             or (case when r.is_deleted then 'deleted' else r.status::text end) = ${status})
        and (
          (${from}::date is null and ${to}::date is null)
          or exists (
            select 1 from public.audit_log e
            where e.leave_request_id = r.id
              and (${from}::date is null
                   or e.occurred_at >= (${from}::date)::timestamp at time zone 'UTC')
              and (${to}::date is null
                   or e.occurred_at < ((${to}::date + 1))::timestamp at time zone 'UTC')
          )
        )
    ),
    counts as (
      select count(*)::int as total,
             (count(*) filter (where bucket = 'approved'))::int as approved,
             (count(*) filter (where bucket = 'rejected'))::int as rejected,
             (count(*) filter (where bucket = 'pending'))::int as pending,
             (count(*) filter (where bucket = 'deleted'))::int as deleted
      from f
    ),
    page as (
      select f.*, u.name as employee_name, u.role as employee_role, lt.name as leave_type_name,
             d.name as decided_by_name, d.role as decided_by_role,
             exists (
               select 1 from public.audit_log a
               where a.leave_request_id = f.id and a.action = 'override_approved'
             ) as overridden
      from f
      join public.users u on u.id = f.user_id
      join public.leave_types lt on lt.id = f.leave_type_id
      left join public.users d on d.id = f.decided_by
      order by f.created_at desc, f.id
      offset (select least(${asked}::int,
                           greatest(0, (ceil(total / ${AUDIT_PAGE_SIZE}::numeric)::int - 1)
                                       * ${AUDIT_PAGE_SIZE}::int))
              from counts)
      limit ${AUDIT_PAGE_SIZE}
    )
    select c.total, c.approved, c.rejected, c.pending, c.deleted,
           coalesce((
             select json_agg(json_build_object(
                      'id', p.id, 'employeeId', p.user_id, 'employeeName', p.employee_name,
                      'employeeRole', p.employee_role, 'leaveTypeName', p.leave_type_name,
                      'startDate', p.start_date::text, 'endDate', p.end_date::text,
                      'status', p.status, 'isDeleted', p.is_deleted,
                      'decidedByName', p.decided_by_name, 'decidedByRole', p.decided_by_role,
                      'decidedAt', p.decided_at, 'createdAt', p.created_at,
                      'overridden', p.overridden)
                    order by p.created_at desc, p.id)
             from page p
           ), '[]'::json) as rows
    from counts c`;

  if (!raw) throw new Error("The audit list read returned no row.");
  const { rows, ...counts } = raw;
  const pages = Math.max(1, Math.ceil(counts.total / AUDIT_PAGE_SIZE));
  return {
    counts,
    page: Math.min(query.page, pages),
    rows: rows.map((r) => ({ ...r, workingDays: countWorkingDays(r.startDate, r.endDate) })),
  };
}

export type AuditFilterChoices = {
  leaveTypes: { id: string; name: string }[];
  /** People who have decided at least one request. */
  deciders: { id: string; name: string; role: UserRole }[];
  /** Every employee's name, for the search box's suggestions (at most EMPLOYEE_SUGGESTIONS). */
  employeeNames: string[];
};

/** The most names offered as suggestions; typing still searches everyone beyond this. */
export const EMPLOYEE_SUGGESTIONS = 500;

/** The options of the leave type and decided-by selects and the name suggestions, in one statement. */
export async function getAuditFilterChoices(sql: Sql): Promise<AuditFilterChoices> {
  const [row] = await sql<AuditFilterChoices[]>`
    select
      coalesce((select json_agg(json_build_object('id', lt.id, 'name', lt.name) order by lt.name)
                from public.leave_types lt), '[]'::json) as "leaveTypes",
      coalesce((select json_agg(json_build_object('id', u.id, 'name', u.name, 'role', u.role)
                                order by u.name, u.id)
                from public.users u
                where exists (select 1 from public.leave_requests r where r.decided_by = u.id)),
               '[]'::json) as deciders,
      coalesce((select json_agg(n.name order by n.name)
                from (select u.name from public.users u order by u.name
                      limit ${EMPLOYEE_SUGGESTIONS}) n), '[]'::json) as "employeeNames"`;
  if (!row) throw new Error("The audit filter choices read returned no row.");
  return row;
}
