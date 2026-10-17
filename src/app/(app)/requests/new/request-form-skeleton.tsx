import { Skeleton, SkeletonField } from "@/components/ui/skeleton";

/** Mirrors the form: leave type, two dates, reason and the submit button. Shared by the route's
 * loading state and the <Suspense> fallback, so both look the same. */
export function RequestFormSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <SkeletonField />
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonField />
        <SkeletonField />
      </div>
      <SkeletonField tall />
      <Skeleton className="h-11 w-full sm:w-40" />
    </div>
  );
}
