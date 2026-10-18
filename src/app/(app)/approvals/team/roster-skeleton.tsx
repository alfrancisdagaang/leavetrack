import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Mirrors the roster: a row per person with an avatar, a name and status, a chip and the columns. */
export function RosterSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="!p-4 sm:!p-5">
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-32" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
