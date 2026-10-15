import Image from "next/image";
import type { SummaryCardView } from "@/lib/leave/dashboard";

const ICON: Record<string, string> = {
  vacation: "/icons/sun.svg",
  sick: "/icons/heart-pulse.svg",
  unpaid: "/icons/calendar-minus.svg",
  approvals: "/icons/users-card.svg",
};

/** One dashboard summary tile. Presentational: all numbers and wording arrive in `card`. */
export function SummaryCard({ card }: { card: SummaryCardView }) {
  return (
    <section className="flex min-h-[148px] flex-col gap-2.5 rounded-tile bg-white p-5 shadow-tile">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 text-[13px] font-semibold text-ink">{card.title}</h2>
        <Image
          src={ICON[card.key] ?? "/icons/calendar-minus.svg"}
          alt=""
          width={18}
          height={18}
          unoptimized
        />
      </div>
      {card.amount !== null ? (
        <p className="flex items-baseline gap-1.5">
          <span className="text-[30px] font-bold leading-tight text-ink">{card.amount}</span>
          <span className="text-xs text-ink-muted">{card.unit}</span>
        </p>
      ) : card.headline ? (
        <p className="text-xl font-bold leading-tight text-ink min-[400px]:text-[26px]">
          {card.headline}
        </p>
      ) : null}
      <p className="text-xs leading-normal text-ink-muted">
        {card.lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
    </section>
  );
}
