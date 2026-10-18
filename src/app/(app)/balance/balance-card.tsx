import Image from "next/image";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { leaveTypeLook } from "@/components/ui/leave-type-icon";
import type { BalanceBreakdownItem } from "@/lib/leave/breakdown";

/** "1 day", "12 days", "11.25 days", "−3 days". Amounts are shown as stored (up to 2 decimals). */
export function formatDays(n: number): string {
  const abs = Math.abs(n);
  const text = `${abs} day${abs === 1 ? "" : "s"}`;
  return n < 0 ? `−${text}` : text;
}

/**
 * The derived line that makes the figures add up. A negative value is not a real opening balance
 * (the balance moved in a way the ledger does not explain), so it is called "Adjustments".
 */
export function reconciliationLabel(openingBalance: number): "Opening balance" | "Adjustments" {
  return openingBalance < 0 ? "Adjustments" : "Opening balance";
}

/**
 * One line of a card. The visible operator (+, −, =) sits in a small gutter beside the label and is
 * hidden from assistive technology; its word ("plus", "minus", "equals") is read with the value
 * instead, so the equation makes sense without seeing it. A value of 0 is muted (the line stays,
 * because the four lines must always show how the balance is built). The `strong` line is never muted.
 */
function Row({
  label,
  sign,
  signWord,
  children,
  strong,
  zero,
  gutter = true,
}: {
  label: string;
  sign?: "+" | "−" | "=";
  signWord?: string;
  children: ReactNode;
  strong?: boolean;
  zero?: boolean;
  gutter?: boolean;
}) {
  const muted = zero && !strong;
  return (
    <div
      className={`flex items-center justify-between gap-2 ${strong ? "border-t border-line pt-2" : ""}`}
    >
      <dt
        className={`flex min-w-0 items-center gap-2 text-sm ${strong ? "font-medium text-ink" : "text-ink-muted"}`}
      >
        {gutter ? (
          <span aria-hidden="true" className="w-4 shrink-0 text-center">
            {sign ?? ""}
          </span>
        ) : null}
        <span>{label}</span>
      </dt>
      <dd
        className={`text-right ${strong ? "font-semibold text-ink" : muted ? "text-ink-muted" : "font-medium text-ink"}`}
      >
        {signWord ? <span className="sr-only">{signWord} </span> : null}
        {children}
      </dd>
    </div>
  );
}

/** The icon tile, the leave type's name and whether a balance is tracked for it. */
function CardHeader({ item }: { item: BalanceBreakdownItem }) {
  const look = leaveTypeLook(item.leaveTypeName);
  return (
    <div className="mb-4 flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${look.tint}`}
      >
        <Image src={look.icon} alt="" width={20} height={20} unoptimized />
      </span>
      <h2 className="min-w-0 flex-1 text-lg font-semibold text-ink">{item.leaveTypeName}</h2>
      <Badge variant="neutral">{item.tracksBalance ? "Tracked" : "Not tracked"}</Badge>
    </div>
  );
}

/**
 * One leave type on My balance (US-02). A tracked type shows what is available, then how the
 * balance is built (opening + accrued - used = confirmed) and what is set aside (pending).
 * An untracked type (Unpaid) has no balance, so it shows only pending and used days. The note that
 * explains the equation is shown once on the page, not on each card.
 */
export function BalanceCard({ item }: { item: BalanceBreakdownItem }) {
  if (
    !item.tracksBalance ||
    item.confirmed === null ||
    item.available === null ||
    item.accruedThisYear === null ||
    item.openingBalance === null
  ) {
    return (
      <Card>
        <CardHeader item={item} />
        <p aria-hidden="true" className="text-3xl font-bold leading-tight text-ink">
          —
        </p>
        <p className="mb-4 text-sm text-ink-muted">No balance is tracked for this leave type.</p>
        <dl className="space-y-2">
          <Row label="Pending approval" zero={item.pending === 0} gutter={false}>
            {formatDays(item.pending)}
          </Row>
          <Row label="Used this year" zero={item.usedThisYear === 0} gutter={false}>
            {formatDays(item.usedThisYear)}
          </Row>
        </dl>
      </Card>
    );
  }

  const label = reconciliationLabel(item.openingBalance);
  const id = `balance-${item.leaveTypeId}`;

  return (
    <Card>
      <CardHeader item={item} />
      <p className="text-3xl font-bold leading-tight text-ink">{formatDays(item.available)}</p>
      <p className="mb-5 text-sm text-ink-muted">Available after pending</p>

      <h3 id={`${id}-built`} className="mb-2 text-sm font-semibold text-ink">
        How your balance is built
      </h3>
      <div role="group" aria-labelledby={`${id}-built`}>
        <dl className="space-y-2">
          <Row label={label} zero={item.openingBalance === 0}>
            {formatDays(item.openingBalance)}
          </Row>
          <Row label="Accrued this year" sign="+" signWord="plus" zero={item.accruedThisYear === 0}>
            {formatDays(item.accruedThisYear)}
          </Row>
          <Row label="Used this year" sign={"−"} signWord="minus" zero={item.usedThisYear === 0}>
            {formatDays(item.usedThisYear)}
          </Row>
          <Row label="Confirmed balance" sign="=" signWord="equals" strong>
            {formatDays(item.confirmed)}
          </Row>
        </dl>
      </div>

      <h3 id={`${id}-set-aside`} className="mb-2 mt-5 text-sm font-semibold text-ink">
        Set aside
      </h3>
      <div role="group" aria-labelledby={`${id}-set-aside`}>
        <dl className="space-y-2">
          <Row label="Pending approval" zero={item.pending === 0}>
            {formatDays(item.pending)}
          </Row>
        </dl>
      </div>
    </Card>
  );
}
