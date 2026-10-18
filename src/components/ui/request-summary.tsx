import Image from "next/image";
import { leaveTypeLook } from "@/components/ui/leave-type-icon";
import type { RequestPreview } from "@/lib/leave/request-preview";

/**
 * The "Request summary" card (Figma 26:17552): the chosen type, the dates, the working days and
 * what is left afterwards, plus who reviews it. Presentational: everything arrives in `preview`.
 * `reviewerName` is null when it could not be read, and the row is then left out.
 */
export function RequestSummaryCard({
  preview,
  reviewerName,
}: {
  preview: RequestPreview;
  reviewerName: string | null;
}) {
  return (
    <section
      aria-labelledby="request-summary-heading"
      className="flex min-h-[210px] flex-col gap-5 rounded-tile border border-line bg-white p-5 shadow-tile sm:p-6"
    >
      <div className="flex items-center gap-3">
        <h2 id="request-summary-heading" className="min-w-0 flex-1 text-lg font-bold text-ink">
          Request summary
        </h2>
        <Image src="/icons/clipboard-list.svg" alt="" width={20} height={20} unoptimized />
      </div>

      {preview.kind === "ready" ? (
        <div className="flex flex-col gap-[18px]">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Image
              src={leaveTypeLook(preview.leaveTypeName).icon}
              alt=""
              width={18}
              height={18}
              unoptimized
            />
            {preview.leaveTypeName}
          </p>
          <div className="space-y-2 leading-normal">
            <p className="text-base font-semibold text-ink">{preview.rangeText}</p>
            <p className="text-sm text-ink-muted">{preview.daysText}</p>
          </div>
          <hr className="border-line" />
          {preview.balanceAfterText !== null ? (
            <p className={`text-sm leading-[1.6] ${preview.over ? "text-warn-fg" : "text-ink"}`}>
              Balance after this request: <strong>{preview.balanceAfterText}</strong>
            </p>
          ) : (
            <p className="text-sm leading-[1.6] text-ink-muted">
              This leave type has no balance limit.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <hr className="border-line" />
          <p className="text-sm leading-[1.6] text-ink-muted">
            {preview.kind === "invalid"
              ? "Correct your dates to see a summary."
              : "Choose your dates to see a summary."}
          </p>
        </div>
      )}

      {reviewerName !== null ? (
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">Reviewer</span>
          <span className="text-[13px] font-semibold text-ink">{reviewerName}</span>
        </p>
      ) : null}
    </section>
  );
}
