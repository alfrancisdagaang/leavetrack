import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Mirrors the employees card: a title, a search block, then rows (cards on a phone, table rows on a desktop). */
export function PolicyListSkeleton({ rows }: { rows: number }) {
  return (
    <SkeletonCard className="space-y-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-11 w-full" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </SkeletonCard>
  );
}
