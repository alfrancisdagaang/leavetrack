import { LoadingRegion, Skeleton, SkeletonCard, SkeletonHeader } from "@/components/ui/skeleton";

/** Mirrors My balance: header with an action, three balance cards, then the request list. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader action />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} className="space-y-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-12" />
            </div>
          </SkeletonCard>
        ))}
      </div>

      <Skeleton className="mb-3 mt-8 h-6 w-32" />
      <div aria-hidden="true" className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-grey-200 bg-white p-4"
          >
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
