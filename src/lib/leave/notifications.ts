import type { Sql } from "postgres";
import type { NotificationKind } from "@/lib/db/types";

/**
 * TASK-054 (EPIC-9). The session user's notifications. Every statement is scoped by
 * `recipient_id = ${userId}` in the SQL (AGENTS.md rule 3), and callers pass the SESSION user's id,
 * never a client value. Only ids, the kind and the request's public facts are read: the employee's
 * name, the leave type and the dates. The employee's reason and a decision note are never selected.
 * The sentence shown to the person is built by the bell from these fields, so the wording lives in
 * one place.
 */
export const NOTIFICATION_PAGE_SIZE = 20;

export type NotificationView = {
  id: string;
  kind: NotificationKind;
  createdAt: string;
  /** Null while unread. */
  readAt: string | null;
  requestId: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  /** The request was soft-deleted. The notification stays, so the bell can say so. */
  requestRemoved: boolean;
};

export type NotificationList = { unread: number; notifications: NotificationView[] };

type ListRow = {
  unread: number;
  items: {
    id: string;
    kind: NotificationKind;
    created_at: string;
    read_at: string | null;
    request_id: string;
    employee_name: string;
    leave_type_name: string;
    start_date: string;
    end_date: string;
    request_removed: boolean;
  }[];
};

/**
 * The latest {@link NOTIFICATION_PAGE_SIZE} notifications (read or not), newest first, and the
 * unread count, in ONE statement (one pooled connection). `is_deleted` is deliberately not
 * filtered: a notification about a since-removed request still shows, flagged.
 */
export async function listNotifications(sql: Sql, userId: string): Promise<NotificationList> {
  const [row] = await sql<ListRow[]>`
    select
      (select count(*)::int from public.notifications
        where recipient_id = ${userId} and read_at is null) as unread,
      coalesce((
        select json_agg(x order by x.created_at desc, x.id desc)
        from (
          select n.id, n.kind, n.created_at, n.read_at, n.leave_request_id as request_id,
                 e.name as employee_name, lt.name as leave_type_name,
                 r.start_date::text as start_date, r.end_date::text as end_date,
                 r.is_deleted as request_removed
          from public.notifications n
          join public.leave_requests r on r.id = n.leave_request_id
          join public.users e on e.id = r.user_id
          join public.leave_types lt on lt.id = r.leave_type_id
          where n.recipient_id = ${userId}
          order by n.created_at desc, n.id desc
          limit ${NOTIFICATION_PAGE_SIZE}
        ) x), '[]'::json) as items`;
  return {
    unread: row?.unread ?? 0,
    notifications: (row?.items ?? []).map((i) => ({
      id: i.id,
      kind: i.kind,
      createdAt: i.created_at,
      readAt: i.read_at,
      requestId: i.request_id,
      employeeName: i.employee_name,
      leaveTypeName: i.leave_type_name,
      startDate: i.start_date,
      endDate: i.end_date,
      requestRemoved: i.request_removed,
    })),
  };
}

export type MarkReadResult = { marked: number; unread: number };

/**
 * Marks the session user's unread notifications read: every one, or just `id`. ONE statement.
 * `read_at is null` stays in the UPDATE, so a second simultaneous call finds nothing to change
 * instead of tripping the read-once trigger. A foreign, unknown or already-read id changes nothing
 * and answers `marked: 0`, the same in all three cases, so the answer never says whether an id
 * exists. `unread` is what remains after this call (the outer select cannot see its own CTE's
 * update, so the marked ids are excluded by hand).
 */
export async function markNotificationsRead(
  sql: Sql,
  userId: string,
  id?: string,
): Promise<MarkReadResult> {
  const [row] = await sql<MarkReadResult[]>`
    with marked as (
      update public.notifications
      set read_at = now()
      where recipient_id = ${userId} and read_at is null
        and (${id ?? null}::uuid is null or id = ${id ?? null}::uuid)
      returning id
    )
    select
      (select count(*)::int from marked) as marked,
      (select count(*)::int from public.notifications n
        where n.recipient_id = ${userId} and n.read_at is null
          and n.id not in (select id from marked)) as unread`;
  return { marked: row?.marked ?? 0, unread: row?.unread ?? 0 };
}
