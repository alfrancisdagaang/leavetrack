import { LoadingRegion, SkeletonHeader } from "@/components/ui/skeleton";
import { RequestFormSkeleton } from "./request-form-skeleton";

/** Mirrors Request leave: the header and the workspace (cards, details, summary, guidance). */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <RequestFormSkeleton />
    </LoadingRegion>
  );
}
