import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Mirrors the member page: the back link and the person, the filters, the requests. */
export function MemberSkeleton() {
  return (
    <div>
      <div className="mb-6 space-y-4">
        <Skeleton className="h-5 w-36" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
      <SkeletonCard className="mb-6 space-y-4">
        <Skeleton className="h-7 w-24" />
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_0.9fr_auto] lg:items-end">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
          <Skeleton className="h-11 w-full sm:w-36" />
        </div>
      </SkeletonCard>
      <Skeleton className="mb-3 h-7 w-32" />
      <SkeletonCard className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
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
