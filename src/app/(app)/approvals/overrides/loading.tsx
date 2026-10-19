import { LoadingRegion, SkeletonHeader } from "@/components/ui/skeleton";
import { DecidedSkeleton, PendingSkeleton } from "../approvals-skeleton";

/** Mirrors HR overrides: the header, the queue rows, then the recently overridden rows. */
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
