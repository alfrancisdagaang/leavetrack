import { unstable_rethrow } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { timedRead } from "@/lib/db/timed";
import type { LeaveStatus } from "@/lib/db/types";
import { getLastAccrualPeriod } from "@/lib/leave/accrual";
import { getMySummary, requireDb, type MySummary } from "@/lib/leave/service";
import { logger } from "@/lib/logger";

const STATUS_BADGE: Record<LeaveStatus, { variant: BadgeVariant; label: string }> = {
  pending: { variant: "pending", label: "Pending" },
  approved: { variant: "approved", label: "Approved" },
  rejected: { variant: "rejected", label: "Rejected" },
};

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** "2026-10" → "October 2026" (the accrual months are UTC). */
function monthLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The caption about the last accrual. Decoration only: if it cannot be read, the page omits it. */
async function accrualNote(): Promise<string | null> {
  try {
    const period = await timedRead("balance.last_accrual", () => getLastAccrualPeriod(requireDb()));
    return period
      ? `Balances are as of the last monthly accrual (${monthLabel(period)}).`
      : "No monthly accrual has run yet; balances are the opening amounts.";
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err }, "balance: last accrual unavailable");
    return null;
  }
}

/**
 * US-02. Confirmed balance and pending amounts are shown separately; pending is never deducted.
 * Streams in under the page header. The balances are the point of the page, so if they cannot be
 * read it says so with a way to retry; the accrual caption is optional and never blocks them.
 */
export async function BalanceSection({ userId }: { userId: string }) {
  const [summary, note] = await Promise.all([
    timedRead("balance.summary", () => getMySummary(requireDb(), userId)).catch(
      (err: unknown): MySummary | null => {
        unstable_rethrow(err);
        logger.warn({ err }, "balance: summary unavailable");
        return null;
      },
    ),
    accrualNote(),
  ]);

  if (!summary) {
    return (
      <div className="space-y-4">
        <Alert variant="error">
          Your balance could not be loaded right now. Try again in a moment.
        </Alert>
        <ButtonLink href="/balance" variant="secondary" prefetch={false}>
          Try again
        </ButtonLink>
      </div>
    );
  }

  const { balances, requests } = summary;
  const typeName = new Map(balances.map((b) => [b.leaveTypeId, b.leaveTypeName]));
  const hasAnyBalance = balances.some((b) => b.tracksBalance && (b.confirmed ?? 0) > 0);

  return (
    <>
      {note ? <p className="-mt-3 mb-4 text-sm text-ink-muted">{note}</p> : null}

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
                  <dt className="text-sm text-ink-muted">Confirmed balance</dt>
                  <dd className="text-2xl font-semibold text-ink">{days(b.confirmed ?? 0)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-sm text-ink-muted">Pending approval</dt>
                  <dd className="font-medium text-ink">{days(b.pending)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-sm text-ink-muted">Available after pending</dt>
                  <dd className="font-medium text-ink">{days(b.available ?? 0)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-ink-muted">
                No balance is tracked for this leave type.
                {b.pending > 0 ? ` ${days(b.pending)} pending approval.` : ""}
              </p>
            )}
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-ink">My requests</h2>
      {requests.length === 0 ? (
        <p className="text-ink-muted">You have not submitted any requests yet.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => {
            const badge = STATUS_BADGE[r.status];
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-tile border border-brand-50 bg-white p-4 shadow-tile"
              >
                <div>
                  <p className="font-medium text-ink">
                    {typeName.get(r.leave_type_id) ?? "Leave"} · {days(r.working_days)}
                  </p>
                  <p className="text-sm text-ink-muted">
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
