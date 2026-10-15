import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

/** Mirrors the dashboard: a welcome block with an action, then a row of summary cards. */
export default function Loading() {
  return (
    <LoadingRegion>
      <div aria-hidden="true" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 basis-72 space-y-3">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-11 w-36" />
        </div>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
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
        <div className="space-y-5 rounded-tile bg-white p-5 shadow-tile sm:p-6">
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
      </div>
    </LoadingRegion>
  );
}
