import type { ReactNode } from "react";

/**
 * One section of Team Approvals as a card: a round icon, the title and a count chip on the right,
 * then the rows. Presentational: the heading id lets the section name itself.
 */
export function ApprovalCard({
  headingId,
  title,
  chip,
  icon,
  chipIcon,
  children,
}: {
  headingId: string;
  title: string;
  /** The short count on the right, such as "2 pending". */
  chip: string;
  icon: ReactNode;
  chipIcon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-tile border border-brand-50 bg-white p-4 shadow-tile sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"
          >
            {icon}
          </span>
          <h2 id={headingId} className="min-w-0 text-xl font-semibold text-ink">
            {title}
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-ink-muted">
          {chipIcon}
          {chip}
        </span>
      </div>
      {children}
    </section>
  );
}
