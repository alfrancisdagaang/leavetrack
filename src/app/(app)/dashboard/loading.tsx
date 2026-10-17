import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { CalendarSkeleton, SummaryCardsSkeleton } from "./skeletons";

/** Mirrors the dashboard: a welcome block with an action, a row of summary cards, the calendar. */
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
        <SummaryCardsSkeleton count={4} />
        <CalendarSkeleton />
      </div>
    </LoadingRegion>
  );
}
