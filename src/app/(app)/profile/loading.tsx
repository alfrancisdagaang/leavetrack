import { LoadingRegion, Skeleton, SkeletonHeader } from "@/components/ui/skeleton";
import { OverviewSkeleton } from "./overview-skeleton";

/** Mirrors My Profile: header, the tab strip, then the Overview card. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <div aria-hidden="true" className="mb-6 flex gap-2 border-b border-line pb-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-7 w-28" />
        ))}
      </div>
      <OverviewSkeleton />
    </LoadingRegion>
  );
}
