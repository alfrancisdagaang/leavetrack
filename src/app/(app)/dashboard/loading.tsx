import { LoadingRegion, Skeleton, SkeletonCard, SkeletonHeader } from "@/components/ui/skeleton";

/** Mirrors the dashboard: a header and a grid of cards, each with a line of text and a button. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="space-y-3">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-11 w-24" />
          </SkeletonCard>
        ))}
      </div>
    </LoadingRegion>
  );
}
