import { Badge } from "@/components/ui/badge";
import { formatActivityTime } from "@/lib/leave/format";
import type { TeamRequestView } from "@/lib/leave/team";
import type { TeamQueueQuery, TeamSort } from "@/lib/leave/team-queue-schema";
import { ApprovalActions } from "./approval-actions";
import { RequestIdentity, ApprovalRow } from "./approval-row";
import { sortHref } from "./approvals-url";
import { balanceText } from "./balance-text";
import { CELL, TableShell, Th } from "./list-parts";
import { DatesColumn } from "./row-layout";

const workingDays = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;

/**
 * The pending requests of the manager's team (EPIC-14): a table from `xl` (employee, dates with the reason
 * beneath, when it was submitted, the balance state, and Approve and Reject) and the original request cards
 * below it. The decision buttons are the same client component in both, so the decision flow, the over-balance
 * rule and what a request that cannot be approved says are unchanged. The server decides everything that
 * matters (scope, balance, status).
 */
export function PendingList({
  rows,
  query,
  now,
  timeZone,
}: {
  rows: readonly TeamRequestView[];
  query: TeamQueueQuery;
  now: Date;
  timeZone: string;
}) {
  const sort = (key: TeamSort) => ({
    href: sortHref(query, key),
    direction: query.sort === key ? query.dir : null,
  });
  return (
    <>
      <TableShell label="Pending requests">
        <thead>
          <tr>
            <Th sort={sort("name")}>Employee</Th>
            <Th sort={sort("start")}>Dates</Th>
            <Th sort={sort("created")}>Submitted</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const note = balanceText(r.balanceCheck, r.working_days, r.leave_type_name);
            return (
              <tr key={r.id} className="hover:bg-brand-50/40">
                <th scope="row" className={`${CELL} text-left font-normal`}>
                  <RequestIdentity name={r.employee_name} leaveTypeName={r.leave_type_name} />
                </th>
                <td className={CELL}>
                  <DatesColumn
                    start={r.start_date}
                    end={r.end_date}
                    days={workingDays(r.working_days)}
                  />
                  {r.reason ? (
                    <p className="mt-2 break-words text-sm text-ink-muted [overflow-wrap:anywhere]">
                      Reason: {r.reason}
                    </p>
                  ) : null}
                </td>
                <td className={`${CELL} text-sm text-ink-muted`}>
                  {formatActivityTime(r.created_at.toISOString(), now, timeZone)}
                </td>
                <td className={CELL}>
                  <div className="space-y-1">
                    <Badge variant="pending">Pending</Badge>
                    {note ? (
                      <>
                        <p className="text-sm font-semibold text-ink">{note.headline}</p>
                        <p className="break-words text-sm text-ink-muted">{note.detail}</p>
                      </>
                    ) : null}
                  </div>
                </td>
                <td className={`${CELL} min-w-[11rem]`}>
                  <div className="[&>div]:mt-0">
                    <ApprovalActions requestId={r.id} canApprove showApprove={note === null} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
      <ul aria-label="Pending requests" className="space-y-3 xl:hidden">
        {rows.map((r) => (
          <ApprovalRow key={r.id} request={r} />
        ))}
      </ul>
    </>
  );
}
