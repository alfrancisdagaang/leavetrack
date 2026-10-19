import { Badge } from "@/components/ui/badge";
import { formatActivityTime } from "@/lib/leave/format";
import type { OverrideQueueRow, RecentOverrideView } from "@/lib/leave/override-queue";
import { ApprovalActions } from "../approval-actions";
import { RequestIdentity } from "../approval-row";
import { DatesColumn, GRID3, GRID4, NoteStrip, ROW } from "../row-layout";

/** numeric text such as "3.00" or "0.50" written as people say it: "3", "0.5". */
const num = (value: string) => String(Number(value));
const dayWord = (value: string) => (Number(value) === 1 ? "day" : "days");
const days = (value: string) => `${num(value)} ${dayWord(value)}`;
const workingDays = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;

/**
 * One pending request that asks for more days than the employee has (PRD US-01 AC3). The shortfall
 * and the effect of approving are written out; nothing relies on colour. The employee's reason is
 * shown because HR needs it to decide. Approve override and Reject use the TASK-038 route, which
 * decides everything that matters (role, not your own, still pending, still over balance).
 */
export function OverrideRow({ request: r }: { request: OverrideQueueRow }) {
  return (
    <li className={ROW}>
      <div className={GRID4}>
        <RequestIdentity name={r.employee_name} leaveTypeName={r.leave_type_name} />
        <DatesColumn
          start={r.start_date}
          end={r.end_date}
          days={workingDays(r.working_days)}
          manager={r.manager_name}
        />
        <div className="min-w-0 space-y-1">
          <Badge variant="pending">Pending</Badge>
          <p className="text-sm font-semibold text-ink">Over balance by {days(r.shortfall)}</p>
          <p className="text-sm text-ink-muted">
            {r.leave_type_name} balance is {days(r.balance)}.
          </p>
          {r.reason ? (
            <p className="break-words text-sm text-ink-muted">Reason: {r.reason}</p>
          ) : null}
        </div>
        {/* ApprovalActions brings its own top margin; the grid gap spaces it here instead. */}
        <div className="[&>div]:mt-0">
          <ApprovalActions
            requestId={r.id}
            canApprove
            endpoint="override"
            approveLabel="Approve override"
          />
        </div>
      </div>
      <NoteStrip>
        {Number(r.balance) === 0
          ? `Approving keeps their ${r.leave_type_name} balance at 0 and records a shortfall of ${days(r.shortfall)} in the audit history.`
          : `Approving uses all of their ${days(r.balance)} of ${r.leave_type_name} and records a shortfall of ${days(r.shortfall)} in the audit history.`}
      </NoteStrip>
    </li>
  );
}

/** One override approval, from the audit log: who it was for, the shortfall, who approved and when. */
export function RecentOverrideRow({
  override: o,
  now,
  timeZone,
}: {
  override: RecentOverrideView;
  now: Date;
  timeZone: string;
}) {
  return (
    <li className={ROW}>
      <div className={GRID3}>
        <RequestIdentity name={o.employee_name} leaveTypeName={o.leave_type_name} />
        <DatesColumn
          start={o.start_date}
          end={o.end_date}
          days={`${num(o.days_requested)} working ${dayWord(o.days_requested)}`}
        />
        <div className="min-w-0 space-y-1">
          <Badge variant="approved">Approved (HR override)</Badge>
          <p className="text-sm font-semibold text-ink">Shortfall: {days(o.shortfall)}</p>
          <p className="break-words text-sm text-ink-muted">
            By {o.approved_by_name} ·{" "}
            <time dateTime={o.occurred_at.toISOString()}>
              {formatActivityTime(o.occurred_at.toISOString(), now, timeZone)}
            </time>
          </p>
        </div>
      </div>
    </li>
  );
}
