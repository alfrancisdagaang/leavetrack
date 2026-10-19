import { requestBadge } from "@/app/(app)/approvals/team/team-format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { BalanceBreakdownItem } from "@/lib/leave/breakdown";
import { checkOverBalance } from "@/lib/leave/over-balance";
import type { LeaveRequestView } from "@/lib/leave/service";
import { formatDays } from "./balance-card";

const HEADER = "pb-2 pr-4 text-sm font-medium text-ink-muted";

/**
 * The status chip, and a rejected request's reason beside it. Status is always written out: an
 * approval HR made as an override says so, and a pending request that asks for more than the
 * confirmed balance says it is waiting for an HR override (TASK-040).
 */
function Status({
  request,
  shortfall,
}: {
  request: LeaveRequestView;
  /** Days over the confirmed balance, for a pending request HR can override; otherwise null. */
  shortfall: number | null;
}) {
  const badge = requestBadge(request.status, request.overridden);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {request.status === "rejected" && request.decision_note ? (
          <span className="text-sm text-rejected-fg">Reason: {request.decision_note}</span>
        ) : null}
      </div>
      {shortfall !== null ? (
        <p className="text-sm text-ink-muted">
          Waiting for HR override: over your balance by {formatDays(shortfall)}.
        </p>
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
  balances,
}: {
  requests: readonly LeaveRequestView[];
  typeNames: ReadonlyMap<string, string>;
  /** The confirmed balance per leave type, for the "waiting for HR override" note. */
  balances: readonly Pick<BalanceBreakdownItem, "leaveTypeId" | "tracksBalance" | "confirmed">[];
}) {
  const nameOf = (request: LeaveRequestView) => typeNames.get(request.leave_type_id) ?? "Leave";
  const byType = new Map(balances.map((b) => [b.leaveTypeId, b]));
  // Only a PENDING request the HR override queue would list (same shared rule). A missing balance
  // row reads as 0 confirmed here, so it shows the note too; seeded users all have a row.
  const shortfallOf = (request: LeaveRequestView): number | null => {
    if (request.status !== "pending") return null;
    const item = byType.get(request.leave_type_id);
    if (!item) return null;
    const check = checkOverBalance({
      tracksBalance: item.tracksBalance,
      balance: item.confirmed,
      days: request.working_days,
    });
    return check.kind === "over" ? check.shortfall : null;
  };

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
                    <Status request={r} shortfall={shortfallOf(r)} />
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
                  <Status request={r} shortfall={shortfallOf(r)} />
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
