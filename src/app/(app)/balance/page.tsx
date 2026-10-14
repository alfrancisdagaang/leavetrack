import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/guards";
import type { LeaveStatus } from "@/lib/db/types";
import { getMySummary, requireDb } from "@/lib/leave/service";

export const metadata: Metadata = { title: "My balance" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<LeaveStatus, { variant: BadgeVariant; label: string }> = {
  pending: { variant: "pending", label: "Pending" },
  approved: { variant: "approved", label: "Approved" },
  rejected: { variant: "rejected", label: "Rejected" },
};

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** US-02. Confirmed balance and pending amounts are shown separately; pending is never deducted. */
export default async function BalancePage() {
  const { user } = await requireSession();
  const { balances, requests } = await getMySummary(requireDb(), user.id);
  const typeName = new Map(balances.map((b) => [b.leaveTypeId, b.leaveTypeName]));
  const hasAnyBalance = balances.some((b) => b.tracksBalance && (b.confirmed ?? 0) > 0);

  return (
    <>
      <PageHeader
        title="My balance"
        description="Balances are as of the last accrual run. Pending requests are not deducted until approved."
        action={<ButtonLink href="/requests/new">Request leave</ButtonLink>}
      />

      {!hasAnyBalance ? (
        <div className="mb-4">
          <Alert variant="info">No balance set up yet for your account.</Alert>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {balances.map((b) => (
          <Card key={b.leaveTypeId} title={b.leaveTypeName}>
            {b.tracksBalance ? (
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm text-grey-500">Confirmed balance</dt>
                  <dd className="text-2xl font-semibold text-navy-900">{days(b.confirmed ?? 0)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-sm text-grey-500">Pending approval</dt>
                  <dd className="font-medium text-grey-900">{days(b.pending)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-sm text-grey-500">Available after pending</dt>
                  <dd className="font-medium text-grey-900">{days(b.available ?? 0)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-grey-500">
                No balance is tracked for this leave type.
                {b.pending > 0 ? ` ${days(b.pending)} pending approval.` : ""}
              </p>
            )}
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-navy-900">My requests</h2>
      {requests.length === 0 ? (
        <p className="text-grey-500">You have not submitted any requests yet.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => {
            const badge = STATUS_BADGE[r.status];
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-grey-200 bg-white p-4"
              >
                <div>
                  <p className="font-medium text-grey-900">
                    {typeName.get(r.leave_type_id) ?? "Leave"} · {days(r.working_days)}
                  </p>
                  <p className="text-sm text-grey-500">
                    {r.start_date} to {r.end_date}
                  </p>
                  {r.status === "rejected" && r.decision_note ? (
                    <p className="mt-1 text-sm text-rejected-fg">Reason: {r.decision_note}</p>
                  ) : null}
                </div>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
