import { Skeleton } from "@/components/ui/skeleton";

/** One grid for the real cards and their placeholders, so the layout does not jump on load. */
export function cardsGridClass(count: number): string {
  // Two columns below xl: an odd last card takes the whole row, so no row has a hole beside it.
  return `grid grid-cols-2 gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 xl:[&>*:last-child:nth-child(odd)]:col-span-1 ${count === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`;
}

/** Mirrors the row of summary cards. */
export function SummaryCardsSkeleton({ count }: { count: number }) {
  return (
    <div aria-hidden="true" className={cardsGridClass(count)}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex min-h-[148px] flex-col gap-2.5 rounded-tile bg-white p-5 shadow-tile"
        >
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Mirrors the leave calendar card. */
export function CalendarSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-5 rounded-tile bg-white p-5 shadow-tile sm:p-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-52" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-11 w-44" />
      </div>
      <div className="overflow-hidden rounded-lg border border-line">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[86px] w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}

/** Mirrors the Upcoming leave and Recent activity cards (a heading and a few rows). */
export function ListCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="rounded-tile bg-white p-5 shadow-tile sm:p-6">
      <Skeleton className="my-3 h-5 w-36" />
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex min-h-[78px] items-center gap-3 border-t border-line first:border-t-0"
        >
          <Skeleton className="size-[50px] shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mirrors the HR "Next 7 days" strip. */
export function OutStripSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4 rounded-tile bg-white p-5 shadow-tile sm:p-6">
      <Skeleton className="h-5 w-32" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
