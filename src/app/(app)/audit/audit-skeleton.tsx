import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Mirrors the audit list: the filter card, the five summary figures, and the rows. */
export function AuditSkeleton() {
  return (
    <div>
      <SkeletonCard className="mb-6 space-y-4">
        <Skeleton className="h-7 w-24" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 sm:col-span-2 lg:col-span-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-11 w-full" />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-11 w-full sm:w-36" />
      </SkeletonCard>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} className="space-y-2 !p-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-12" />
          </SkeletonCard>
        ))}
      </div>
      <Skeleton className="mb-3 h-7 w-32" />
      <SkeletonCard className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-wrap items-center justify-between gap-3 py-1">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </SkeletonCard>
    </div>
  );
}
