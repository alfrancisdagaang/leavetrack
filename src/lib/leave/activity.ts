import type { Sql } from "postgres";
import type { UserRole } from "@/lib/db/types";
import type { IsoDate } from "@/lib/leave/calendar-layout";

/**
 * US-11. The latest decision events on the dashboard's "Recent activity" card, read from the
 * append-only `audit_log`. Scope is by the OWNER of the request and lives in the SQL
 * (AGENTS.md rule 3), chosen from the SERVER session, never from the client:
 *   - employee: events on their own requests
 *   - manager:  events on their own and their direct reports' requests (`owner.manager_id`)
 *   - hr_admin: everyone
 * Soft-deleted requests are NOT filtered out: a cancelled request's `soft_deleted` event is exactly
 * what this feed reports. Newest first. Dates come back as text; the timestamp as an ISO string.
 */
export const ACTIVITY_LIMIT = 5;

export type ActivityQuery = {
  role: UserRole;
  userId: string;
};

export type ActivityAction =
  "submitted" | "approved" | "rejected" | "soft_deleted" | "override_approved";

export type ActivityEvent = {
  id: string;
  action: ActivityAction;
  occurredAt: string;
  actorId: string;
  actorName: string;
  ownerId: string;
  ownerName: string;
  leaveTypeName: string;
  startDate: IsoDate;
  endDate: IsoDate;
};

type Row = {
  id: string;
  action: ActivityAction;
  occurred_at: Date | string;
  actor_id: string;
  actor_name: string;
  owner_id: string;
  owner_name: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
};

export async function getRecentActivity(
  sql: Sql,
  { role, userId }: ActivityQuery,
): Promise<ActivityEvent[]> {
  const rows =
    role === "hr_admin"
      ? await sql<Row[]>`
          select a.id, a.action, a.occurred_at, a.actor_id, actor.name as actor_name,
                 owner.id as owner_id, owner.name as owner_name, lt.name as leave_type_name,
                 r.start_date::text as start_date, r.end_date::text as end_date
          from public.audit_log a
          join public.leave_requests r on r.id = a.leave_request_id
          join public.users owner on owner.id = r.user_id
          join public.users actor on actor.id = a.actor_id
          join public.leave_types lt on lt.id = r.leave_type_id
          order by a.occurred_at desc, a.id desc
          limit ${ACTIVITY_LIMIT}`
      : role === "manager"
        ? await sql<Row[]>`
            select a.id, a.action, a.occurred_at, a.actor_id, actor.name as actor_name,
                   owner.id as owner_id, owner.name as owner_name, lt.name as leave_type_name,
                   r.start_date::text as start_date, r.end_date::text as end_date
            from public.audit_log a
            join public.leave_requests r on r.id = a.leave_request_id
            join public.users owner on owner.id = r.user_id
            join public.users actor on actor.id = a.actor_id
            join public.leave_types lt on lt.id = r.leave_type_id
            where (r.user_id = ${userId} or owner.manager_id = ${userId})
            order by a.occurred_at desc, a.id desc
            limit ${ACTIVITY_LIMIT}`
        : await sql<Row[]>`
            select a.id, a.action, a.occurred_at, a.actor_id, actor.name as actor_name,
                   owner.id as owner_id, owner.name as owner_name, lt.name as leave_type_name,
                   r.start_date::text as start_date, r.end_date::text as end_date
            from public.audit_log a
            join public.leave_requests r on r.id = a.leave_request_id
            join public.users owner on owner.id = r.user_id
            join public.users actor on actor.id = a.actor_id
            join public.leave_types lt on lt.id = r.leave_type_id
            where r.user_id = ${userId}
            order by a.occurred_at desc, a.id desc
            limit ${ACTIVITY_LIMIT}`;

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    occurredAt: new Date(row.occurred_at).toISOString(),
    actorId: row.actor_id,
    actorName: row.actor_name,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    leaveTypeName: row.leave_type_name,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}
