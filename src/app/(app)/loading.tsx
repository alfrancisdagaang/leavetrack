import { LoadingRegion, Skeleton, SkeletonCard, SkeletonHeader } from "@/components/ui/skeleton";

/**
 * Fallback loading state for any signed-in page without its own. Next.js shows it inside the app
 * shell while the page waits for its data, so a nav click gives feedback at once.
 */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <SkeletonCard key={i} className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </SkeletonCard>
        ))}
      </div>
    </LoadingRegion>
  );
}
