import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

/** Mirrors the dashboard: a welcome block and a grid of icon cards, each with text and a button. */
export default function Loading() {
  return (
    <LoadingRegion>
      <div
        aria-hidden="true"
        className="relative left-1/2 w-[min(1352px,calc(100vw-4rem))] -translate-x-1/2 max-sm:left-0 max-sm:w-full max-sm:translate-x-0"
      >
        <div className="space-y-3 pb-6 pt-4 sm:pt-10">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2 xl:gap-[26px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex gap-4 rounded-tile bg-white px-5 py-6 shadow-tile sm:gap-8 sm:px-8"
            >
              <Skeleton className="size-16 shrink-0 rounded-2xl sm:h-20 sm:w-[82px]" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-[54px] w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
