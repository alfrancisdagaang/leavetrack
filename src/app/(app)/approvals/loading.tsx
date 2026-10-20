import { LoadingRegion, SkeletonHeader } from "@/components/ui/skeleton";
import { ApprovalsSkeleton } from "./approvals-skeleton";

/** Mirrors Team Approvals: the header, the tabs' height, then the tiles, filters and list. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <ApprovalsSkeleton />
    </LoadingRegion>
  );
}
