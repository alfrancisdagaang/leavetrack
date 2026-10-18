import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the workspace: three leave type cards, the details card, and the summary and guidance cards. Shared
 * by the route's loading state and the <Suspense> fallback, so both look the same. */
export function RequestFormSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid gap-6 pb-44 sm:pb-0 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
    >
      <div className="min-w-0 space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-20" />
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[156px] rounded-tile sm:h-[178px]" />
            ))}
          </div>
        </div>
        <div className="space-y-6 rounded-tile bg-white p-5 shadow-tile sm:p-6">
          <Skeleton className="h-5 w-36" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-[70px]" />
            <Skeleton className="h-[70px]" />
          </div>
          <Skeleton className="h-[128px]" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
      <div className="min-w-0 space-y-6">
        <Skeleton className="h-[210px] rounded-tile" />
        <Skeleton className="h-[260px] rounded-tile" />
      </div>
    </div>
  );
}
