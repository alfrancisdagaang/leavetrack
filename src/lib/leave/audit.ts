import type { Sql } from "postgres";
import type { AuditAction, LeaveStatus, UserRole } from "@/lib/db/types";
import { AppError } from "@/lib/errors/app-error";
import type { AuditQuery } from "@/lib/leave/schemas";
import { countWorkingDays } from "@/lib/leave/working-days";

/**
 * TASK-015 (US-05, BR-04). HR's read-only decision history for one employee.
 * The role gate (hr_admin) is applied by the caller; this module only reads.
 *
 * Deliberately NOT included: any time cutoff or row cap (nothing inside the 3-year retention may be
 * hidden), and the employee's free-text `reason` (it can hold medical details, and the compliance
 * record does not need it). Soft-deleted requests are hidden unless `includeDeleted` is set.
 */

export type AuditEvent = {
  action: AuditAction;
  actor_id: string;
  actor_name: string;
  /** ISO timestamp as rendered by Postgres. */
  occurred_at: string;
};

export type AuditRequestView = {
  id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  working_days: number;
  status: LeaveStatus;
  created_at: Date;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: Date | null;
  decision_note: string | null;
  is_deleted: boolean;
  /** The request's full timeline, oldest first, regardless of the date range. */
  events: AuditEvent[];
};

export type AuditEmployee = { id: string; name: string; role: UserRole };
export type AuditHistory = { employee: AuditEmployee; requests: AuditRequestView[] };

type RequestRow = Omit<AuditRequestView, "working_days">;

export async function getAuditHistory(
  sql: Sql,
  userId: string,
  query: Pick<AuditQuery, "from" | "to" | "include_deleted">,
): Promise<AuditHistory> {
  const [employee] = await sql<AuditEmployee[]>`
    select id, name, role from public.users where id = ${userId}`;
  if (!employee) throw new AppError("NOT_FOUND", "No employee with that id.");

  const from = query.from ?? null;
  const to = query.to ?? null;

  // A request matches a date range when ANY of its audit events falls inside it. The bounds are UTC
  // midnights, so the database session time zone cannot move a day. With no range, nothing is cut.
  const rows = await sql<RequestRow[]>`
    select r.id, lt.name as leave_type_name,
           r.start_date::text as start_date, r.end_date::text as end_date,
           r.status, r.created_at, r.decided_by, d.name as decided_by_name,
           r.decided_at, r.decision_note, r.is_deleted,
           coalesce((
             select json_agg(
                      json_build_object('action', a.action, 'actor_id', a.actor_id,
                                        'actor_name', au.name, 'occurred_at', a.occurred_at)
                      order by a.occurred_at, a.id)
             from public.audit_log a
             join public.users au on au.id = a.actor_id
             where a.leave_request_id = r.id
           ), '[]'::json) as events
    from public.leave_requests r
    join public.leave_types lt on lt.id = r.leave_type_id
    left join public.users d on d.id = r.decided_by
    where r.user_id = ${userId}
      and (${query.include_deleted}::boolean or r.is_deleted = false)
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
    order by r.created_at desc`;

  return {
    employee,
    requests: rows.map((row) => ({
      ...row,
      working_days: countWorkingDays(row.start_date, row.end_date),
    })),
  };
}

/** Everyone HR can look up, for the employee picker. */
export async function listEmployees(sql: Sql): Promise<AuditEmployee[]> {
  return sql<AuditEmployee[]>`
    select id, name, role from public.users order by name`;
}
