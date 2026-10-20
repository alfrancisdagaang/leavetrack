import { LoadingRegion, SkeletonHeader } from "@/components/ui/skeleton";
import { ApprovalsSkeleton } from "../approvals-skeleton";

/** Mirrors Balance Overrides: the header, then the tiles, filters and list. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <ApprovalsSkeleton />
    </LoadingRegion>
  );
}
