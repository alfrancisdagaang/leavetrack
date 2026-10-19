import Image from "next/image";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { initialsOf } from "@/components/ui/initials";
import { leaveTypeLook } from "@/components/ui/leave-type-icon";
import type { TeamRequestView } from "@/lib/leave/team";
import { ApprovalActions } from "./approval-actions";
import { balanceText } from "./balance-text";

export const ROW = "rounded-tile border border-brand-50 bg-white p-4 shadow-tile sm:p-5";
/** Columns shared by both lists so the pending and the decided rows line up from `lg`. */
export const ROW_GRID =
  "grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_18rem] lg:items-start";

const workingDays = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;

/** The person (avatar and name) and the leave type (icon tile and name). Shared by both row types. */
export function RequestIdentity({ name, leaveTypeName }: { name: string; leaveTypeName: string }) {
  const look = leaveTypeLook(leaveTypeName);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600"
      >
        {initialsOf(name)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-ink">{name}</p>
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <span
            aria-hidden="true"
            className={`flex size-5 shrink-0 items-center justify-center rounded-full ${look.tint}`}
          >
            <Image src={look.icon} alt="" width={12} height={12} unoptimized />
          </span>
          {leaveTypeName}
        </p>
      </div>
    </div>
  );
}

/**
 * One pending request from a direct report (US-03, US-04), as a row in the same structure as the My
 * team roster. The employee's reason is shown here, on a pending request only, because the manager
 * needs it to decide. When the balance does not allow approving it (TASK-040) the row says why in
 * text and offers Reject only; otherwise Approve and Reject as before. The server decides
 * everything that matters (scope, balance, status).
 */
export function ApprovalRow({ request: r }: { request: TeamRequestView }) {
  const note = balanceText(r.balanceCheck, r.working_days, r.leave_type_name);
  return (
    <li className={ROW}>
      <div className={ROW_GRID}>
        <RequestIdentity name={r.employee_name} leaveTypeName={r.leave_type_name} />
        <div>
          <p className="font-medium text-ink">
            {r.start_date} to {r.end_date}
          </p>
          <p className="text-sm text-ink-muted">{workingDays(r.working_days)}</p>
        </div>
        {/* min-w-0 and break-words: a long unbroken word in the reason must wrap, not scroll sideways. */}
        <div className="min-w-0 space-y-1">
          <Badge variant="pending">Pending</Badge>
          {r.reason ? (
            <p className="break-words text-sm text-ink-muted">Reason: {r.reason}</p>
          ) : null}
        </div>
        {/* ApprovalActions brings its own top margin; the grid gap spaces it here instead. */}
        <div className="[&>div]:mt-0">
          <ApprovalActions requestId={r.id} canApprove showApprove={note === null} />
        </div>
      </div>
      {note ? (
        <div className="mt-3">
          <Alert variant="warning" title={note.headline}>
            {note.detail}
          </Alert>
        </div>
      ) : null}
    </li>
  );
}
