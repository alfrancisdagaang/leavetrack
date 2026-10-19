import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Mirrors the chart card (a title, a few person cards) beside the side card. Shared by loading.tsx and Suspense. */
export function OrgSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonCard>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 shrink-0 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-5 w-56 max-w-full" />
            <Skeleton className="h-5 w-40" />
          </div>
        </div>
      </SkeletonCard>
      <SkeletonCard>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-3">
            <Skeleton className="h-7 w-64 max-w-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <div className="mx-auto max-w-md space-y-3 pt-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[66px] w-full rounded-lg" />
              ))}
            </div>
          </div>
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      </SkeletonCard>
    </div>
  );
}
