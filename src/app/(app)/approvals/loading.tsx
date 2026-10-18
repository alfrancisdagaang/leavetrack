import { LoadingRegion, SkeletonHeader } from "@/components/ui/skeleton";
import { DecidedSkeleton, PendingSkeleton, TabsSkeleton } from "./approvals-skeleton";

/** Mirrors Team approvals: the header, the tabs, then the pending rows and the decided rows. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <TabsSkeleton />
      <div className="space-y-8">
        <PendingSkeleton />
        <DecidedSkeleton />
      </div>
    </LoadingRegion>
  );
}
