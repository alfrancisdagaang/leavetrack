import Image from "next/image";
import { Card } from "@/components/ui/card";
import { leaveTypeLook } from "@/components/ui/leave-type-icon";
import type { BalanceSummaryItem } from "@/lib/leave/balance";
import { formatDays } from "../team-format";

/**
 * The person's balance per tracked type (US-13 AC1): what is available after pending, and how it is
 * made up. The same figures as their My Balance page. Presentational: the balances arrive as props.
 */
export function MemberBalances({ balances }: { balances: readonly BalanceSummaryItem[] }) {
  if (balances.length === 0) return null;

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2">
      {balances.map((b) => {
        const look = leaveTypeLook(b.leaveTypeName);
        return (
          <Card key={b.leaveTypeId}>
            <div className="mb-3 flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${look.tint}`}
              >
                <Image src={look.icon} alt="" width={20} height={20} unoptimized />
              </span>
              <h2 className="text-lg font-semibold text-ink">{b.leaveTypeName}</h2>
            </div>
            <p className="text-3xl font-bold leading-tight text-ink">
              {formatDays(b.available ?? 0)}
            </p>
            <p className="text-sm text-ink-muted">Available after pending</p>
            <p className="mt-2 text-sm text-ink-muted">
              {`Confirmed ${b.confirmed ?? 0} · Pending ${b.pending}`}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
