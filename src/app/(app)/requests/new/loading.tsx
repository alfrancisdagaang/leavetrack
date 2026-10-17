import { LoadingRegion, SkeletonCard, SkeletonHeader } from "@/components/ui/skeleton";
import { RequestFormSkeleton } from "./request-form-skeleton";

/** Mirrors Request leave: header and the form card (type, two dates, reason, submit button). */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <div className="max-w-xl">
        <SkeletonCard>
          <RequestFormSkeleton />
        </SkeletonCard>
      </div>
    </LoadingRegion>
  );
}
