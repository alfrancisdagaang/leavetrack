import { LoadingRegion, SkeletonHeader } from "@/components/ui/skeleton";
import { OverrideCardSkeleton } from "./override-skeleton";

/** Mirrors Balance Overrides: the header, the queue card, then the recently overridden card. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <div className="space-y-8">
        <OverrideCardSkeleton rows={2} />
        <OverrideCardSkeleton rows={2} />
      </div>
    </LoadingRegion>
  );
}
