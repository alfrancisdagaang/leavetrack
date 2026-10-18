import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Mirrors the tab bar. */
export function TabsSkeleton() {
  return (
    <div aria-hidden="true" className="mb-6 flex gap-2 border-b border-line">
      <Skeleton className="mb-2 h-7 w-24" />
      <Skeleton className="mb-2 h-7 w-24" />
    </div>
  );
}

function RowSkeleton({ withActions }: { withActions: boolean }) {
  return (
    <SkeletonCard className="!p-4 sm:!p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_18rem] lg:items-start">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
        {withActions ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-11 w-full sm:w-28" />
            <Skeleton className="h-11 w-full sm:w-28" />
          </div>
        ) : null}
      </div>
    </SkeletonCard>
  );
}

/** Mirrors the pending queue: a heading and request rows with the Approve and Reject buttons. */
export function PendingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="mb-3 h-7 w-48" />
      {[0, 1].map((i) => (
        <RowSkeleton key={i} withActions />
      ))}
    </div>
  );
}

/** Mirrors Recently decided: a heading and decided rows. */
export function DecidedSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="mb-3 h-7 w-40" />
      {[0, 1].map((i) => (
        <RowSkeleton key={i} withActions={false} />
      ))}
    </div>
  );
}
