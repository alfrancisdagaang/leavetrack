import { Badge } from "@/components/ui/badge";
import { formatActivityTime } from "@/lib/leave/format";
import type { DecidedTeamRequestView } from "@/lib/leave/team";
import type { TeamQueueQuery, TeamSort } from "@/lib/leave/team-queue-schema";
import { RequestIdentity } from "./approval-row";
import { sortHref } from "./approvals-url";
import { DecidedRow } from "./decided-row";
import { CELL, TableShell, Th } from "./list-parts";
import { DatesColumn } from "./row-layout";
import { requestBadge } from "./team/team-format";

const workingDays = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;

/**
 * The team's decided requests (EPIC-14): a table from `xl` (employee, dates, the outcome in words with the
 * manager's rejection note, and when it was decided) and the original cards below it. Read-only: a decided
 * request has no actions and never carries the employee's reason.
 */
export function DecidedList({
  rows,
  query,
  now,
  timeZone,
}: {
  rows: readonly DecidedTeamRequestView[];
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
      <TableShell label="Decided requests">
        <thead>
          <tr>
            <Th sort={sort("name")}>Employee</Th>
            <Th sort={sort("start")}>Dates</Th>
            <Th>Outcome</Th>
            <Th sort={sort("decided")}>Decided</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const badge = requestBadge(r.status, r.overridden);
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
                </td>
                <td className={CELL}>
                  <div className="space-y-1">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    {r.status === "rejected" && r.decision_note ? (
                      <p className="break-words text-sm text-rejected-fg [overflow-wrap:anywhere]">
                        Rejection note: {r.decision_note}
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className={`${CELL} text-sm text-ink-muted`}>
                  {formatActivityTime(r.decided_at.toISOString(), now, timeZone)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
      <ul aria-label="Decided requests" className="space-y-3 xl:hidden">
        {rows.map((r) => (
          <DecidedRow key={r.id} request={r} now={now} timeZone={timeZone} />
        ))}
      </ul>
    </>
  );
}
