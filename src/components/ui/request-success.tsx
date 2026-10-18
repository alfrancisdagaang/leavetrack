import Image from "next/image";
import Link from "next/link";
import type { LeaveWarning } from "@/lib/leave/balance";

/**
 * The confirmation that replaces the form after a request is submitted (Figma "10 Success"). The
 * over-balance warning from the server still shows here: it is not in the Figma, but dropping it
 * would hide the one thing the person was told to expect. Presentational: `onAnother` resets.
 */
export function RequestSuccess({
  leaveTypeName,
  rangeText,
  daysText,
  warnings,
  onAnother,
}: {
  leaveTypeName: string;
  /** "Nov 2–4 2026" */
  rangeText: string;
  /** "3 working days" */
  daysText: string;
  warnings: readonly LeaveWarning[];
  onAnother: () => void;
}) {
  return (
    <section
      aria-labelledby="request-submitted-heading"
      className="flex flex-col gap-6 rounded-tile border border-line bg-white p-6 shadow-tile sm:p-8"
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-approved-bg"
      >
        <Image src="/icons/check-success.svg" alt="" width={26} height={26} unoptimized />
      </span>
      <div className="space-y-2">
        <h2
          id="request-submitted-heading"
          tabIndex={-1}
          className="text-2xl font-bold text-ink outline-none"
        >
          Request submitted
        </h2>
        <p className="text-sm leading-normal text-ink-muted">Your manager can now review it</p>
      </div>
      <div className="flex flex-col gap-3 rounded-lg bg-page p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">{leaveTypeName}</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-pending-bg px-2.5 py-1 text-xs font-semibold text-pending-fg">
            <Image src="/icons/clock-3.svg" alt="" width={12} height={12} unoptimized />
            Pending
          </span>
        </div>
        <p className="text-sm leading-normal text-ink">{rangeText}</p>
        <p className="text-sm text-ink-muted">{daysText}</p>
      </div>
      {warnings.map((w) => (
        <p
          key={w.code}
          role="note"
          className="flex items-start gap-2 rounded-lg bg-warn-bg p-3 text-[13px] font-medium leading-normal text-warn-fg"
        >
          <Image src="/icons/triangle-alert.svg" alt="" width={18} height={18} unoptimized />
          <span>Over your available balance. {w.message}</span>
        </p>
      ))}
      <div className="flex flex-col gap-3">
        <Link
          href="/balance"
          prefetch={false}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-brand-500 bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          View my balance
        </Link>
        <button
          type="button"
          onClick={onAnother}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line bg-white px-5 text-sm font-semibold text-ink hover:bg-brand-50"
        >
          Submit another
        </button>
      </div>
    </section>
  );
}
