import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Mirrors the HR calendar: the month and filters card, then the weekday cells. */
export function CalendarSkeleton() {
  return (
    <div>
      <SkeletonCard className="mb-6 space-y-4">
        <Skeleton className="h-11 w-64" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="h-11 w-full sm:w-28" />
      </SkeletonCard>
      <div className="space-y-2">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            {[0, 1, 2, 3, 4].map((cell) => (
              <Skeleton key={cell} className={`h-24 w-full ${cell > 1 ? "hidden sm:block" : ""}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
