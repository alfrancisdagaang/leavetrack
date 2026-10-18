import Image from "next/image";

/**
 * The bottom of the Request details card: the over-balance note, a server error, and the Submit
 * button (Figma "Submission"). Below `sm` it is a bar fixed to the bottom of the screen (Figma
 * "Sticky submit"), above `sm` it sits inside the card. Presentational: the form owns the state.
 *
 * States: idle, `pending` (spinner, "Submitting…"), `blocked` (the dates are wrong: muted with a
 * lock, and really disabled). The over-balance note is advisory and never blocks.
 */
export function SubmitBar({
  pending,
  blocked,
  overBalance,
  error,
}: {
  pending: boolean;
  blocked: boolean;
  overBalance: boolean;
  error: string | null;
}) {
  const button = blocked
    ? "border-line bg-page text-ink-muted cursor-not-allowed"
    : pending
      ? "border-brand-500 bg-brand-500 text-white cursor-wait"
      : "border-brand-500 bg-brand-500 text-white hover:bg-brand-600 hover:border-brand-600";
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 border-t border-line bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0">
      {overBalance ? (
        <p
          role="note"
          className="flex items-start gap-2 rounded-lg bg-warn-bg p-3 text-[13px] font-medium leading-normal text-warn-fg"
        >
          <Image src="/icons/triangle-alert.svg" alt="" width={18} height={18} unoptimized />
          Over your available balance
        </p>
      ) : null}
      {error ? (
        <p
          id="request-error"
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-rejected-bg p-3 text-[13px] font-medium leading-normal text-event-rejected"
        >
          <Image src="/icons/circle-alert.svg" alt="" width={18} height={18} unoptimized />
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={blocked || pending}
        aria-busy={pending || undefined}
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-5 text-sm font-semibold transition-colors ${button}`}
      >
        {pending ? (
          <Image
            src="/icons/loader-circle.svg"
            alt=""
            width={18}
            height={18}
            unoptimized
            className="motion-safe:animate-spin"
          />
        ) : blocked ? (
          <Image src="/icons/lock.svg" alt="" width={16} height={16} unoptimized />
        ) : null}
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </div>
  );
}
