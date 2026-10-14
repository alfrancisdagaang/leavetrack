import { LoadingRegion, Skeleton, SkeletonCard, SkeletonHeader } from "@/components/ui/skeleton";

/** Mirrors Team approvals: header, then request cards with a status line and Approve/Reject buttons. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <div className="space-y-4">
        {[0, 1].map((i) => (
          <SkeletonCard key={i}>
            <Skeleton className="mb-3 h-6 w-40" />
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-5 w-52" />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Skeleton className="h-11 w-full sm:w-28" />
              <Skeleton className="h-11 w-full sm:w-28" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </LoadingRegion>
  );
}
