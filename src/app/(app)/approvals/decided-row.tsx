import { Badge } from "@/components/ui/badge";
import { formatActivityTime } from "@/lib/leave/format";
import type { DecidedTeamRequestView } from "@/lib/leave/team";
import { RequestIdentity } from "./approval-row";
import { DatesColumn, GRID3, ROW } from "./row-layout";
import { requestBadge } from "./team/team-format";

const workingDays = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;

/**
 * One recently decided request, as a row. The status is written out. A rejection shows the manager's
 * own note. There is no employee reason here (a decided request never carries it) and no actions.
 */
export function DecidedRow({
  request: r,
  now,
  timeZone,
}: {
  request: DecidedTeamRequestView;
  /** With both, the row says when it was decided. */
  now?: Date;
  timeZone?: string;
}) {
  const badge = requestBadge(r.status, r.overridden);
  return (
    <li className={ROW}>
      <div className={GRID3}>
        <RequestIdentity name={r.employee_name} leaveTypeName={r.leave_type_name} />
        <DatesColumn start={r.start_date} end={r.end_date} days={workingDays(r.working_days)} />
        <div className="min-w-0 space-y-1">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          {now && timeZone ? (
            <p className="text-sm text-ink-muted">
              Decided {formatActivityTime(r.decided_at.toISOString(), now, timeZone)}
            </p>
          ) : null}
          {r.status === "rejected" && r.decision_note ? (
            <p className="break-words text-sm text-rejected-fg">
              Rejection note: {r.decision_note}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}
