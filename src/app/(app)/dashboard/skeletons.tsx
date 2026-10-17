import { Skeleton } from "@/components/ui/skeleton";

/** One grid for the real cards and their placeholders, so the layout does not jump on load. */
export function cardsGridClass(count: number): string {
  return `grid grid-cols-2 gap-4 ${count === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`;
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
