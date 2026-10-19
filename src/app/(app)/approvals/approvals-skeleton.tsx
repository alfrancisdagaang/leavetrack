import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Mirrors one Team Approvals card: the icon, title and chip, then request rows. */
function CardSkeleton({ rows, titleWidth }: { rows: number; titleWidth: string }) {
  return (
    <SkeletonCard className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className={`h-6 ${titleWidth}`} />
        </div>
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </SkeletonCard>
  );
}

/** Mirrors the pending card: the heading and chip, then request rows. */
export function PendingSkeleton() {
  return <CardSkeleton rows={2} titleWidth="w-48" />;
}

/** Mirrors Recently decided: the heading and chip, then decided rows. */
export function DecidedSkeleton() {
  return <CardSkeleton rows={2} titleWidth="w-40" />;
}
