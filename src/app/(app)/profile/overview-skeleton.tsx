import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Mirrors the Overview card: avatar and name, then two fields. Shared by loading.tsx and Suspense. */
export function OverviewSkeleton() {
  return (
    <SkeletonCard className="space-y-5">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-44" />
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}
