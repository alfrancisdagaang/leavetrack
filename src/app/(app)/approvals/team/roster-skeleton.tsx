import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { ROSTER_CELL, ROSTER_GRID } from "./roster-grid";

/** Mirrors the roster: a grid of cards, each with an avatar, a name and status, a chip and a last request. */
export function RosterSkeleton() {
  return (
    <div aria-hidden="true" className={ROSTER_GRID}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={ROSTER_CELL}>
          <SkeletonCard className="w-full space-y-4 !p-4 sm:!p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-10 w-32" />
          </SkeletonCard>
        </div>
      ))}
    </div>
  );
}
