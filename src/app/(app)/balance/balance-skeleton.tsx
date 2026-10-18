import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/**
 * Mirrors the balance cards (icon, name and chip; the hero number; the two groups of lines), the
 * note under them, and the requests card. Shared by the route's loading state and the <Suspense>
 * fallback.
 */
export function BalanceBodySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <Skeleton className="h-6 w-24 flex-1" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-44" />
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
            <Skeleton className="h-4 w-20" />
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-14" />
            </div>
          </SkeletonCard>
        ))}
      </div>

      <Skeleton className="h-12 w-full rounded-lg" />

      <SkeletonCard className="space-y-3">
        <Skeleton className="h-6 w-32" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-wrap items-center justify-between gap-3 py-1">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </SkeletonCard>
    </div>
  );
}
