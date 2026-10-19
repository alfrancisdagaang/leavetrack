import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Mirrors one Balance Overrides card: the icon, title and chip, then request rows. */
export function OverrideCardSkeleton({ rows }: { rows: number }) {
  return (
    <SkeletonCard className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-6 w-56" />
        </div>
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-xl" />
      ))}
    </SkeletonCard>
  );
}
