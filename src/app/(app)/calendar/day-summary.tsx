import Image from "next/image";
import { leaveTypeLook } from "@/components/ui/leave-type-icon";
import type { HrDayCount } from "@/lib/leave/hr-calendar";
import { typeCounts } from "@/lib/leave/hr-calendar-layout";

/**
 * EPIC-7. The open day at a glance: people out per leave type and how many of them are still
 * pending. Each tile writes its name and its number, so the tint is only decoration. The figures are
 * the month's own (same filters), so they always agree with the day's cell.
 */
export function DaySummary({
  count,
  typeNames,
}: {
  count: HrDayCount | undefined;
  typeNames: readonly string[];
}) {
  const tiles = typeCounts(count, typeNames);
  return (
    <ul
      aria-label="People out by leave type"
      className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(6rem,1fr))]"
    >
      {tiles.map((tile) => {
        const look = leaveTypeLook(tile.name);
        return (
          <li
            key={tile.name}
            className="flex items-center gap-2 rounded-lg border border-line bg-white p-2.5"
          >
            <span
              aria-hidden="true"
              className={`flex size-8 shrink-0 items-center justify-center rounded-full ${look.tint}`}
            >
              <Image src={look.icon} alt="" width={16} height={16} unoptimized />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs text-ink-muted">{tile.name}</span>
              <span className="block text-lg font-semibold leading-tight text-ink">
                {tile.people}
              </span>
            </span>
          </li>
        );
      })}
      <li className="flex items-center gap-2 rounded-lg border border-line bg-pending-bg p-2.5">
        <span className="min-w-0">
          <span className="block truncate text-xs text-pending-fg">Pending</span>
          <span className="block text-lg font-semibold leading-tight text-pending-fg">
            {count?.pending ?? 0}
          </span>
        </span>
      </li>
    </ul>
  );
}
