import Image from "next/image";
import type { ReactNode } from "react";
import { ApprovalActions } from "@/app/(app)/approvals/approval-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { leaveTypeLook } from "@/components/ui/leave-type-icon";
import type { MemberRequest } from "@/lib/leave/team-member";
import { formatDays, STATUS_BADGE } from "../team-format";

const HEADER = "pb-2 pr-4 text-sm font-medium text-ink-muted";

/**
 * What goes with a request's status: for a PENDING one, the employee's reason (the manager needs it
 * to decide; the read returns it for pending requests only) and the Approve / Reject controls; for a
 * rejected one, the manager's own note. Status is always written out.
 */
function StatusCell({ request }: { request: MemberRequest }) {
  const badge = STATUS_BADGE[request.status];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {request.status === "pending" && request.reason ? (
          <span className="text-sm text-ink-muted">Reason: {request.reason}</span>
        ) : null}
        {request.status === "rejected" && request.decisionNote ? (
          <span className="text-sm text-rejected-fg">Rejection note: {request.decisionNote}</span>
        ) : null}
      </div>
      {request.status === "pending" ? (
        <>
          {request.insufficient ? (
            <p className="text-sm font-medium text-pending-fg">
              Cannot be approved: not enough balance. Reject it, or ask HR for an override.
            </p>
          ) : null}
          <ApprovalActions requestId={request.id} canApprove={!request.insufficient} />
        </>
      ) : null}
    </div>
  );
}

function TypeName({ request }: { request: MemberRequest }) {
  const look = leaveTypeLook(request.leaveTypeName);
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${look.tint}`}
      >
        <Image src={look.icon} alt="" width={16} height={16} unoptimized />
      </span>
      {request.leaveTypeName}
    </span>
  );
}

/**
 * US-13. One page of a team member's requests, with the match count. From the `sm` breakpoint a real
 * table (column headers, the leave type as the row header); below it, stacked rows. Two native
 * structures with the same rows, one hidden by CSS at each size (the My Balance pattern), so the
 * table's semantics are never switched off. At most 25 rows.
 */
export function MemberRequests({
  requests,
  total,
  children,
}: {
  requests: readonly MemberRequest[];
  total: number;
  /** Shown under the rows: the pagination. */
  children?: ReactNode;
}) {
  return (
    <>
      <h2 className="mb-3 text-xl font-semibold text-ink">
        {`${total} request${total === 1 ? "" : "s"}`}
      </h2>
      <Card>
        <table
          aria-label="Team member's leave requests"
          className="hidden w-full text-left sm:table"
        >
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={HEADER}>
                Leave type
              </th>
              <th scope="col" className={HEADER}>
                Date range
              </th>
              <th scope="col" className={HEADER}>
                Working days
              </th>
              <th scope="col" className="pb-2 text-sm font-medium text-ink-muted">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {requests.map((r) => (
              <tr key={r.id} className="align-top">
                <th scope="row" className="py-3 pr-4 font-medium text-ink">
                  <TypeName request={r} />
                </th>
                <td className="py-3 pr-4 text-ink">
                  {r.startDate} to {r.endDate}
                </td>
                <td className="py-3 pr-4 text-ink">{formatDays(r.workingDays)}</td>
                <td className="py-3">
                  <StatusCell request={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul aria-label="Team member's leave requests" className="divide-y divide-line sm:hidden">
          {requests.map((r) => (
            <li key={r.id} className="space-y-2 py-3">
              <p className="font-medium text-ink">
                <TypeName request={r} />
              </p>
              <p className="text-sm text-ink-muted">
                {r.startDate} to {r.endDate} · {formatDays(r.workingDays)}
              </p>
              <StatusCell request={r} />
            </li>
          ))}
        </ul>

        {children}
      </Card>
    </>
  );
}
