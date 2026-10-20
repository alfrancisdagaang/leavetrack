import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Mirrors an approval list: three tiles, the search and filters, then the table or card rows. */
export function ApprovalsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-tile" />
        ))}
      </div>
      <SkeletonCard className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-11 w-full" />
      </SkeletonCard>
      <SkeletonCard className="space-y-4">
        <Skeleton className="h-6 w-56" />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </SkeletonCard>
    </div>
  );
}
