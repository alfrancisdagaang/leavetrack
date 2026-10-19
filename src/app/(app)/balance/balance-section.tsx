import { unstable_rethrow } from "next/navigation";
import { timedRead } from "@/lib/db/timed";
import { getLastAccrualPeriod } from "@/lib/leave/accrual";
import type { IsoDate } from "@/lib/leave/calendar-layout";
import { yearBounds } from "@/lib/leave/breakdown";
import { getBalancePage, requireDb, type BalancePage } from "@/lib/leave/service";
import { logger } from "@/lib/logger";
import { BalanceCard, reconciliationLabel } from "./balance-card";
import { BalanceRequests } from "./balance-requests";
import { BalanceEmpty, BalanceError, BalanceNote, isBalanceEmpty } from "./balance-states";

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
 * Each tracked type also shows how its days are made up for the calendar year of `today`
 * (opening, accrued, used). Streams in under the page header. The balances are the point of the
 * page, so if they cannot be read it says so with a way to retry; the accrual caption is optional
 * and never blocks them. Two statements here plus the caption: three in all (pool budget).
 */
export async function BalanceSection({ userId, today }: { userId: string; today: IsoDate }) {
  const year = yearBounds(today);
  const [summary, note] = await Promise.all([
    timedRead("balance.summary", () => getBalancePage(requireDb(), userId, year)).catch(
      (err: unknown): BalancePage | null => {
        unstable_rethrow(err);
        logger.warn({ err }, "balance: summary unavailable");
        return null;
      },
    ),
    accrualNote(),
  ]);

  if (!summary) return <BalanceError />;

  const { balances, requests } = summary;
  const typeNames = new Map(balances.map((b) => [b.leaveTypeId, b.leaveTypeName]));
  const hasAdjustments = balances.some(
    (b) => b.openingBalance !== null && reconciliationLabel(b.openingBalance) === "Adjustments",
  );

  return (
    <>
      {note ? <p className="-mt-3 mb-4 text-sm text-ink-muted">{note}</p> : null}

      <div className="space-y-6">
        {isBalanceEmpty(balances) ? (
          <BalanceEmpty />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {balances.map((b) => (
                <BalanceCard key={b.leaveTypeId} item={b} />
              ))}
            </div>
            <BalanceNote adjustments={hasAdjustments} />
          </>
        )}

        <BalanceRequests requests={requests} typeNames={typeNames} balances={balances} />
      </div>
    </>
  );
}
