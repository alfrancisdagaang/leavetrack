import Image from "next/image";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BalanceBreakdownItem } from "@/lib/leave/breakdown";

/**
 * Nothing to show for a balance? Only when every tracked type has no balance, no accrual, no used
 * days and no pending days. A person who spent days this year is NOT empty, even if their balance
 * is now 0: the data cannot tell a missing balance row from a 0 row, so "has any activity" is the
 * safe test. (Known edge: someone at 0 who spent days only in an earlier year and has nothing this
 * year looks empty; telling them apart needs the data layer to say whether a balance row exists.)
 */
export function isBalanceEmpty(items: readonly BalanceBreakdownItem[]): boolean {
  return items
    .filter((i) => i.tracksBalance)
    .every(
      (i) =>
        (i.confirmed ?? 0) === 0 &&
        (i.accruedThisYear ?? 0) === 0 &&
        i.usedThisYear === 0 &&
        i.pending === 0,
    );
}

const EQUATION = "Opening balance + accrued this year − used this year = confirmed balance.";
const USED_NOTE = "Includes approved leave you have not taken yet.";
const ADJUSTMENTS_NOTE =
  "Adjustments appears instead of the opening balance when it would be negative.";

/**
 * The one note that explains the card lines. The extra sentence appears only when a card shows
 * "Adjustments" instead of "Opening balance", so the common case reads as the design does.
 */
export function BalanceNote({ adjustments }: { adjustments: boolean }) {
  return (
    <Alert variant="info">
      <div className="flex items-start gap-3">
        <Image
          src="/icons/info.svg"
          alt=""
          width={20}
          height={20}
          unoptimized
          className="mt-0.5 shrink-0"
        />
        <p>
          {[EQUATION, USED_NOTE, adjustments ? ADJUSTMENTS_NOTE : null].filter(Boolean).join(" ")}
        </p>
      </div>
    </Alert>
  );
}

/** The balances could not be read: say so, and offer a way to try again. */
export function BalanceError() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-rejected-bg"
        >
          <Image src="/icons/circle-alert.svg" alt="" width={24} height={24} unoptimized />
        </span>
        <div role="alert" className="space-y-1">
          <p className="font-semibold text-ink">Your balance could not be loaded right now.</p>
          <p className="text-sm text-ink-muted">Try again in a moment.</p>
        </div>
        <ButtonLink href="/balance" prefetch={false}>
          Try again
        </ButtonLink>
      </div>
    </Card>
  );
}

/** No balance has been set up for this account yet. */
export function BalanceEmpty() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-brand-50"
        >
          <Image src="/icons/clipboard-list.svg" alt="" width={24} height={24} unoptimized />
        </span>
        <div className="space-y-1">
          <p className="font-semibold text-ink">No balance set up yet for your account.</p>
          <p className="text-sm text-ink-muted">Contact your manager or HR for assistance.</p>
        </div>
      </div>
    </Card>
  );
}
