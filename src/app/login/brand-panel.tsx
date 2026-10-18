import Image from "next/image";

/** A calendar with a clock: leave, on the calendar. Drawn in the brand colours; purely decorative. */
function Illustration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 240"
      className="h-auto w-full max-w-sm"
      fill="none"
      focusable="false"
    >
      <circle cx="120" cy="130" r="86" className="fill-nav-item-active" opacity="0.6" />
      <circle cx="226" cy="150" r="62" className="fill-nav-item-active" opacity="0.5" />
      <rect x="62" y="56" width="164" height="136" rx="14" className="fill-white" />
      <path
        d="M62 70a14 14 0 0 1 14-14h136a14 14 0 0 1 14 14v18H62V70Z"
        className="fill-brand-50"
      />
      {[88, 118, 148, 178].map((x) => (
        <rect key={x} x={x} y="40" width="8" height="26" rx="4" className="fill-nav-muted" />
      ))}
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => {
          const marked = (row === 0 && col === 2) || (row === 1 && col === 1);
          return (
            <rect
              key={`${row}-${col}`}
              x={80 + col * 34}
              y={102 + row * 28}
              width="22"
              height="18"
              rx="4"
              className={marked ? "fill-brand-500" : "fill-brand-50"}
            />
          );
        }),
      )}
      <circle cx="214" cy="166" r="44" className="fill-white" />
      <circle cx="214" cy="166" r="44" className="stroke-brand-500" strokeWidth="8" />
      <path d="M214 140v26h22" className="stroke-brand-500" strokeWidth="8" strokeLinecap="round" />
      <circle cx="270" cy="78" r="5" className="fill-nav-active" />
      <circle cx="46" cy="176" r="4" className="fill-nav-active" />
    </svg>
  );
}

/**
 * The navy panel beside the sign-in form (large screens only). Branding and one line of copy; no
 * data, no links. The name is a paragraph, not a heading: the page's only h1 is "Sign in".
 */
export function BrandPanel() {
  return (
    <aside className="hidden flex-col justify-between bg-nav p-12 text-nav-text lg:flex">
      <div className="flex items-center gap-3">
        <Image src="/icons/logo.svg" alt="" width={44} height={44} unoptimized />
        <p className="text-2xl font-bold text-white">LeaveTrack</p>
      </div>
      <div className="space-y-10">
        <p className="max-w-md text-3xl font-semibold leading-snug text-white">
          Simple leave tracking for a healthier, more balanced team.
        </p>
        <Illustration />
      </div>
      <p className="text-sm text-nav-muted">Leave requests, approvals and a clear record.</p>
    </aside>
  );
}
