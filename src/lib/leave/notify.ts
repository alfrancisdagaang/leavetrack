import type { TransactionSql } from "postgres";
import type { NotificationKind } from "@/lib/db/types";

/**
 * TASK-053 (PRD US-01 AC1, US-03). Tells the people affected by one leave event. It must be called
 * INSIDE the event's own `sql.begin`, so the event and its notifications commit or roll back
 * together: a failed insert throws and takes the leave action with it (AGENTS.md rule 5, 11).
 *
 * The recipients are worked out in ONE statement from the database, never from the caller or the
 * client (AGENTS.md rule 3):
 * - the employee, when `toEmployee`;
 * - the employee's own manager (`users.manager_id`), when `toManager`, and only when that person's
 *   role is `manager`. An HR Admin who happens to be somebody's `manager_id` cannot approve any
 *   more (EPIC-10), so telling them would send a notification nobody can act on.
 * - never the person who acted (`actorId`): that is a SQL rule, not an assumption about roles.
 *
 * Only ids and the kind are stored. The message is built when the bell reads it.
 */
export type NotifyEvent = {
  kind: NotificationKind;
  requestId: string;
  /** The request's owner; their `manager_id` is the manager to tell. */
  employeeId: string;
  /** The session user who caused the event. */
  actorId: string;
  toEmployee: boolean;
  toManager: boolean;
};

export async function notifyLeaveEvent(
  tx: TransactionSql,
  { kind, requestId, employeeId, actorId, toEmployee, toManager }: NotifyEvent,
): Promise<void> {
  await tx`
    insert into public.notifications (recipient_id, kind, leave_request_id)
    select r.id, ${kind}, ${requestId}
    from (
      select e.id from public.users e
      where e.id = ${employeeId} and ${toEmployee}::boolean
      union
      select m.id from public.users e
      join public.users m on m.id = e.manager_id
      where e.id = ${employeeId} and m.role = 'manager' and ${toManager}::boolean
    ) r
    where r.id <> ${actorId}`;
}
