import { Badge } from "@/components/ui/badge";
import { formatActivityTime } from "@/lib/leave/format";
import type { OverrideListQuery, OverrideSort } from "@/lib/leave/override-list-schema";
import type { OverrideQueueRow, RecentOverrideView } from "@/lib/leave/override-queue";
import { ApprovalActions } from "../approval-actions";
import { RequestIdentity } from "../approval-row";
import { CELL, TableShell, Th } from "../list-parts";
import { DatesColumn } from "../row-layout";
import { OverrideRow, overrideEffectText, RecentOverrideRow } from "./override-row";
import { sortHref } from "./overrides-url";

/** numeric text such as "3.00" or "0.50" written as people say it: "3", "0.5". */
const num = (value: string) => String(Number(value));
const days = (value: string) => `${num(value)} ${Number(value) === 1 ? "day" : "days"}`;
const workingDays = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;

const sortOf = (query: OverrideListQuery, key: OverrideSort) => ({
  href: sortHref(query, key),
  direction: query.sort === key ? query.dir : null,
});

/**
 * The requests waiting for an HR override (EPIC-14): a table from `xl` (employee, dates with the manager and
 * the reason beneath, the shortfall and what approving does, when it was submitted, and Approve override and
 * Reject) and the original request cards below it. The decision buttons are the same client component in both,
 * so the override flow is unchanged: the TASK-038 route decides everything that matters (role, not your own,
 * still pending, still over balance).
 */
export function WaitingList({
  rows,
  query,
  now,
  timeZone,
}: {
  rows: readonly OverrideQueueRow[];
  query: OverrideListQuery;
  now: Date;
  timeZone: string;
}) {
  return (
    <>
      <TableShell label="Requests waiting for an override">
        <thead>
          <tr>
            <Th sort={sortOf(query, "name")}>Employee</Th>
            <Th sort={sortOf(query, "start")}>Dates</Th>
            <Th sort={sortOf(query, "shortfall")}>Over balance</Th>
            <Th sort={sortOf(query, "created")}>Submitted</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-brand-50/40">
              <th scope="row" className={`${CELL} text-left font-normal`}>
                <RequestIdentity name={r.employee_name} leaveTypeName={r.leave_type_name} />
              </th>
              <td className={CELL}>
                <DatesColumn
                  start={r.start_date}
                  end={r.end_date}
                  days={workingDays(r.working_days)}
                  manager={r.manager_name}
                />
                {r.reason ? (
                  <p className="mt-2 break-words text-sm text-ink-muted [overflow-wrap:anywhere]">
                    Reason: {r.reason}
                  </p>
                ) : null}
              </td>
              <td className={CELL}>
                <div className="space-y-1">
                  <Badge variant="pending">Pending</Badge>
                  <p className="text-sm font-semibold text-ink">
                    Over balance by {days(r.shortfall)}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {r.leave_type_name} balance is {days(r.balance)}.
                  </p>
                  <p className="break-words text-sm text-ink-muted">{overrideEffectText(r)}</p>
                </div>
              </td>
              <td className={`${CELL} text-sm text-ink-muted`}>
                {formatActivityTime(r.created_at.toISOString(), now, timeZone)}
              </td>
              <td className={`${CELL} min-w-[17rem]`}>
                <div className="[&>div]:mt-0">
                  <ApprovalActions
                    requestId={r.id}
                    canApprove
                    endpoint="override"
                    approveLabel="Approve override"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      <ul aria-label="Requests waiting for an override" className="space-y-3 xl:hidden">
        {rows.map((r) => (
          <OverrideRow key={r.id} request={r} />
        ))}
      </ul>
    </>
  );
}

/**
 * The override approvals HR already made (EPIC-14), from the audit log: a table from `xl` (employee, dates,
 * the shortfall, who approved and when) and the original cards below it. Read-only.
 */
export function OverriddenList({
  rows,
  query,
  now,
  timeZone,
}: {
  rows: readonly RecentOverrideView[];
  query: OverrideListQuery;
  now: Date;
  timeZone: string;
}) {
  return (
    <>
      <TableShell label="Overridden requests">
        <thead>
          <tr>
            <Th sort={sortOf(query, "name")}>Employee</Th>
            <Th sort={sortOf(query, "start")}>Dates</Th>
            <Th sort={sortOf(query, "shortfall")}>Shortfall</Th>
            <Th sort={sortOf(query, "approved")}>Approved</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="hover:bg-brand-50/40">
              <th scope="row" className={`${CELL} text-left font-normal`}>
                <RequestIdentity name={o.employee_name} leaveTypeName={o.leave_type_name} />
              </th>
              <td className={CELL}>
                <DatesColumn
                  start={o.start_date}
                  end={o.end_date}
                  days={`${num(o.days_requested)} working ${Number(o.days_requested) === 1 ? "day" : "days"}`}
                />
              </td>
              <td className={CELL}>
                <div className="space-y-1">
                  <Badge variant="approved">Approved (HR override)</Badge>
                  <p className="text-sm font-semibold text-ink">Shortfall: {days(o.shortfall)}</p>
                </div>
              </td>
              <td className={`${CELL} text-sm text-ink-muted`}>
                <p className="break-words">By {o.approved_by_name}</p>
                <p>{formatActivityTime(o.occurred_at.toISOString(), now, timeZone)}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      <ul aria-label="Overridden requests" className="space-y-3 xl:hidden">
        {rows.map((o) => (
          <RecentOverrideRow key={o.id} override={o} now={now} timeZone={timeZone} />
        ))}
      </ul>
    </>
  );
}
