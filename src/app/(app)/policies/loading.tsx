import { LoadingRegion, SkeletonHeader } from "@/components/ui/skeleton";
import { PolicyListSkeleton } from "./policies-skeleton";

/** Mirrors Leave Policies: the header, the employee list, then the recent changes. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <div className="space-y-8">
        <PolicyListSkeleton rows={3} />
        <PolicyListSkeleton rows={2} />
      </div>
    </LoadingRegion>
  );
}
