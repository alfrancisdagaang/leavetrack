import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { LeaveStatus } from "@/lib/db/types";
import type { LeaveRequestView } from "@/lib/leave/service";
import { formatDays } from "./balance-card";

const STATUS_BADGE: Record<LeaveStatus, { variant: BadgeVariant; label: string }> = {
  pending: { variant: "pending", label: "Pending" },
  approved: { variant: "approved", label: "Approved" },
  rejected: { variant: "rejected", label: "Rejected" },
};

const HEADER = "pb-2 pr-4 text-sm font-medium text-ink-muted";

/** The status chip, and a rejected request's reason beside it. Status is always written out. */
function Status({ request }: { request: LeaveRequestView }) {
  const badge = STATUS_BADGE[request.status];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={badge.variant}>{badge.label}</Badge>
      {request.status === "rejected" && request.decision_note ? (
        <span className="text-sm text-rejected-fg">Reason: {request.decision_note}</span>
      ) : null}
    </div>
  );
}

/**
 * US-02. The person's own requests. From the `sm` breakpoint a real table (column headers, the
 * leave type as the row header); below it, stacked rows. They are two native structures with the
 * same rows, one hidden by CSS at each size, instead of one table whose display is switched: that
 * would drop the table semantics in some screen readers. At most 50 requests, so the repeat is small.
 */
export function BalanceRequests({
  requests,
  typeNames,
}: {
  requests: readonly LeaveRequestView[];
  typeNames: ReadonlyMap<string, string>;
}) {
  const nameOf = (request: LeaveRequestView) => typeNames.get(request.leave_type_id) ?? "Leave";

  return (
    <Card title="My requests">
      {requests.length === 0 ? (
        <p className="text-ink-muted">You have not submitted any requests yet.</p>
      ) : (
        <>
          <table aria-label="My leave requests" className="hidden w-full text-left sm:table">
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
                <tr key={r.id}>
                  <th scope="row" className="py-3 pr-4 font-medium text-ink">
                    {nameOf(r)}
                  </th>
                  <td className="py-3 pr-4 text-ink">
                    {r.start_date} to {r.end_date}
                  </td>
                  <td className="py-3 pr-4 text-ink">{formatDays(r.working_days)}</td>
                  <td className="py-3">
                    <Status request={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul aria-label="My leave requests" className="divide-y divide-line sm:hidden">
            {requests.map((r) => (
              <li key={r.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-ink">
                    {nameOf(r)} · {formatDays(r.working_days)}
                  </p>
                  <Status request={r} />
                </div>
                <p className="text-sm text-ink-muted">
                  {r.start_date} to {r.end_date}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
