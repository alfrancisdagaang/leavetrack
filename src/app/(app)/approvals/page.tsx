import type { Metadata } from "next";
import { timedRead } from "@/lib/db/timed";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/guards";
import { requireDb } from "@/lib/leave/service";
import { getRecentlyDecided, getTeamQueue, type TeamRequestView } from "@/lib/leave/team";
import { ApprovalActions } from "./approval-actions";

export const metadata: Metadata = { title: "Team approvals" };
export const dynamic = "force-dynamic";

const days = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;

function balanceNote(r: TeamRequestView): string {
  if (r.balance === null) {
    return "There is no balance record for this leave type.";
  }
  return `${r.leave_type_name} balance is ${r.balance} day${r.balance === 1 ? "" : "s"}.`;
}

/**
 * US-03 / US-04. Pending requests from the signed-in manager's own direct reports. The query is
 * scoped in SQL by the session user's id; the page never receives another team's requests.
 */
export default async function ApprovalsPage() {
  const { user } = await requireRole("manager", "hr_admin");
  const sql = requireDb();
  const [queue, decided] = await Promise.all([
    timedRead("approvals.queue", () => getTeamQueue(sql, user.id)),
    timedRead("approvals.decided", () => getRecentlyDecided(sql, user.id)),
  ]);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Team approvals"
        description="Pending leave requests from your direct reports."
      />

      {queue.length === 0 ? (
        <Card>
          <p className="text-ink-muted">No pending requests from your team.</p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {queue.map((r) => (
            <li key={r.id}>
              <Card title={r.employee_name}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="pending">Pending</Badge>
                  <span className="font-medium text-ink">{r.leave_type_name}</span>
                  <span className="text-ink-muted">· {days(r.working_days)}</span>
                </div>
                <p className="text-ink">
                  {r.start_date} to {r.end_date}
                </p>
                {r.reason ? (
                  <p className="mt-1 text-sm text-ink-muted">Reason: {r.reason}</p>
                ) : null}
                {r.insufficient ? (
                  <div className="mt-3">
                    <Alert variant="warning" title="Cannot be approved">
                      This request is {days(r.working_days)}. {balanceNote(r)} Reject it, or ask HR
                      for an override (not available yet).
                    </Alert>
                  </div>
                ) : null}
                <ApprovalActions requestId={r.id} canApprove={!r.insufficient} />
              </Card>
            </li>
          ))}
        </ul>
      )}

      {decided.length > 0 ? (
        <>
          <h2 className="mb-3 mt-8 text-lg font-semibold text-ink">Recently decided</h2>
          <ul className="space-y-3">
            {decided.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-tile border border-brand-50 bg-white p-4 shadow-tile"
              >
                <div>
                  <p className="font-medium text-ink">
                    {r.employee_name} · {r.leave_type_name} · {days(r.working_days)}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {r.start_date} to {r.end_date}
                  </p>
                  {r.decision_note ? (
                    <p className="mt-1 text-sm text-ink-muted">Reason: {r.decision_note}</p>
                  ) : null}
                </div>
                <Badge variant={r.status === "approved" ? "approved" : "rejected"}>
                  {r.status === "approved" ? "Approved" : "Rejected"}
                </Badge>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
