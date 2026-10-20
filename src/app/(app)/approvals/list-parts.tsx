import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SortHeader } from "@/components/ui/sort-header";
import { CenteredCard } from "./team/team-states";

/**
 * The wide table of an approval list (EPIC-14), from `xl`; below it the page shows cards (the same rows in
 * the original row layout). Two native structures, one hidden by CSS at each size, so the table's semantics
 * are never switched off. The header is sticky inside a height-limited scroll container.
 */
export function TableShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="hidden max-h-[75vh] overflow-auto rounded-xl border border-line xl:block">
      <table aria-label={label} className="w-full border-separate border-spacing-0 text-left">
        {children}
      </table>
    </div>
  );
}

const HEAD =
  "sticky top-0 z-10 border-b border-line bg-white px-3 py-3 text-left text-sm font-medium text-ink-muted";

/** A column header. With `sort` it is a link that sorts (and marks `aria-sort` when it is the sorted one). */
export function Th({
  children,
  sort,
  className = "",
}: {
  children: ReactNode;
  sort?: { href: string; direction: "asc" | "desc" | null };
  className?: string;
}) {
  return (
    <th
      scope="col"
      aria-sort={
        sort?.direction ? (sort.direction === "asc" ? "ascending" : "descending") : undefined
      }
      className={`${HEAD} ${className}`}
    >
      {sort ? (
        <SortHeader href={sort.href} direction={sort.direction}>
          {children}
        </SortHeader>
      ) : (
        children
      )}
    </th>
  );
}

/** A table cell. */
export const CELL = "border-b border-line px-3 py-3 align-top";

/** The card around a list: its title with the true count, then the table, the cards and the pager. */
export function ResultsCard({ title, children }: { title: string; children: ReactNode }) {
  return <Card title={title}>{children}</Card>;
}

/** Nothing matches the search and filters: say so, and offer to clear them. */
export function ListNoMatches({ clearHref, what }: { clearHref: string; what: string }) {
  return (
    <div className="space-y-3 py-2">
      <p role="status" className="text-ink-muted">
        No {what} match these filters.
      </p>
      <ButtonLink href={clearHref} variant="secondary" prefetch={false}>
        Clear filters
      </ButtonLink>
    </div>
  );
}

/** A list could not be read: say so, and offer a way to try again (the address is kept). */
export function ListError({ what, retryHref }: { what: string; retryHref: string }) {
  return (
    <CenteredCard icon="/icons/circle-alert.svg" tint="bg-rejected-bg">
      <div role="alert" className="space-y-1">
        <p className="font-semibold text-ink">{what} could not be loaded right now.</p>
        <p className="text-sm text-ink-muted">Try again in a moment.</p>
      </div>
      <ButtonLink href={retryHref} prefetch={false}>
        Try again
      </ButtonLink>
    </CenteredCard>
  );
}
