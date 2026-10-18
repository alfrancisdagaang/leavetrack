import Image from "next/image";

/**
 * The "Before you submit" info card (Figma 33:801). Static guidance; every line describes what the
 * app does today. When the request is over balance, the balance line is highlighted in the warning
 * colours (the meaning is in the words, so the highlight is not the only cue).
 */
export function BeforeYouSubmitCard({ overBalance = false }: { overBalance?: boolean }) {
  const lines = [
    {
      key: "review",
      text: "Your manager reviews this request. It stays Pending until they decide.",
    },
    {
      key: "days",
      text: "Only working days count (Mon to Fri). Public holidays aren't excluded yet.",
    },
    {
      key: "balance",
      text: "Asking for more than your balance shows a warning. You can still submit it for HR override.",
    },
    { key: "unpaid", text: "Unpaid leave has no balance limit." },
  ];
  return (
    <section
      aria-labelledby="before-you-submit-heading"
      className="flex flex-col gap-4 rounded-tile border border-line bg-white p-5 shadow-tile sm:p-6"
    >
      <div className="flex items-center gap-3">
        <h2
          id="before-you-submit-heading"
          className="min-w-0 flex-1 text-[17px] font-bold text-ink"
        >
          Before you submit
        </h2>
        <Image src="/icons/info.svg" alt="" width={18} height={18} unoptimized />
      </div>
      <ul className="flex flex-col gap-3">
        {lines.map((line) => {
          const highlighted = overBalance && line.key === "balance";
          return (
            <li
              key={line.key}
              className={`flex items-start gap-2 text-xs leading-[1.45] ${
                highlighted ? "rounded-lg bg-warn-bg p-3 text-warn-fg" : "text-ink"
              }`}
            >
              <span
                aria-hidden="true"
                className="mt-[5.5px] size-1.5 shrink-0 rounded-full bg-brand-500"
              />
              <span className="min-w-0 flex-1">{line.text}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] leading-normal text-ink-muted">
        Track it in Recent activity on your dashboard.
      </p>
    </section>
  );
}
