import { LoadingRegion, SkeletonHeader } from "@/components/ui/skeleton";
import { DecidedSkeleton, PendingSkeleton } from "./approvals-skeleton";

/** Mirrors Team approvals: the header, then the pending rows and the decided rows. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <div className="space-y-8">
        <PendingSkeleton />
        <DecidedSkeleton />
      </div>
    </LoadingRegion>
  );
}
