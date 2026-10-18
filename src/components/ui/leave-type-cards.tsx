import Image from "next/image";
import { leaveTypeLook } from "@/components/ui/leave-type-icon";
import type { BalanceSummaryItem } from "@/lib/leave/balance";

/**
 * The leave type picker (Figma "Leave type choices"): one card per type that shows what is left,
 * and doubles as the control. Each card is a native radio, so arrow keys, focus and the form
 * value work without extra code; the check badge and ring come from the radio's state.
 * Presentational: balances and the selected id arrive as props.
 */
export function LeaveTypeCards({
  balances,
  value,
  onChange,
  disabled = false,
}: {
  balances: readonly BalanceSummaryItem[];
  value: string;
  onChange: (leaveTypeId: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <legend className="mb-3 text-sm font-semibold text-ink">Leave type</legend>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {balances.map((item) => {
          const look = leaveTypeLook(item.leaveTypeName);
          const available = item.available === null ? null : Math.max(item.available, 0);
          const empty = available !== null && available === 0;
          return (
            <label key={item.leaveTypeId} className="relative block min-w-0 cursor-pointer">
              <input
                type="radio"
                name="leave_type_id"
                value={item.leaveTypeId}
                checked={value === item.leaveTypeId}
                onChange={() => onChange(item.leaveTypeId)}
                className="peer sr-only"
              />
              <span className="flex h-full min-h-[156px] flex-col gap-2.5 rounded-tile border border-line bg-white p-3 transition-colors peer-checked:border-brand-500 peer-checked:bg-brand-500/[0.04] peer-checked:ring-1 peer-checked:ring-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 sm:min-h-[178px] sm:p-[18px]">
                <span
                  aria-hidden="true"
                  className={`flex size-8 items-center justify-center rounded-full ${look.tint}`}
                >
                  <Image src={look.icon} alt="" width={18} height={18} unoptimized />
                </span>
                <span className="text-sm font-semibold text-ink">{item.leaveTypeName}</span>
                {available === null ? (
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold leading-8 text-ink sm:text-[21px]">
                      Untracked
                    </span>
                    <span className="text-xs leading-[1.4] text-ink-muted">No balance limit</span>
                  </span>
                ) : (
                  <>
                    <span className="flex flex-col gap-0.5">
                      <span
                        className={`text-[26px] font-bold leading-8 sm:text-[30px] ${empty ? "text-warn-fg" : "text-ink"}`}
                      >
                        {available}
                      </span>
                      <span
                        className={`text-xs leading-[1.4] ${empty ? "text-warn-fg" : "text-ink-muted"}`}
                      >
                        {available === 1 ? "day available" : "days available"}
                      </span>
                    </span>
                    <span className="text-xs text-ink-muted">{item.pending} pending</span>
                  </>
                )}
              </span>
              <span
                aria-hidden="true"
                className="absolute right-2 top-2 hidden size-[18px] items-center justify-center rounded-full bg-brand-500 peer-checked:flex"
              >
                <Image src="/icons/check-white.svg" alt="" width={12} height={12} unoptimized />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
