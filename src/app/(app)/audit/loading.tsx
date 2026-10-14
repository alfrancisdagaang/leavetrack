import {
  LoadingRegion,
  Skeleton,
  SkeletonCard,
  SkeletonField,
  SkeletonHeader,
} from "@/components/ui/skeleton";

/** Mirrors the Audit log: header and the filter form (employee, two dates, checkbox, button). */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <SkeletonCard className="space-y-4">
        <SkeletonField />
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonField />
          <SkeletonField />
        </div>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-11 w-full sm:w-36" />
      </SkeletonCard>
    </LoadingRegion>
  );
}
