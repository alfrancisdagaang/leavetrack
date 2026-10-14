import {
  LoadingRegion,
  Skeleton,
  SkeletonCard,
  SkeletonField,
  SkeletonHeader,
} from "@/components/ui/skeleton";

/** Mirrors Request leave: header and the form card (type, two dates, reason, submit button). */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <div className="max-w-xl">
        <SkeletonCard className="space-y-4">
          <SkeletonField />
          <div className="grid gap-4 sm:grid-cols-2">
            <SkeletonField />
            <SkeletonField />
          </div>
          <SkeletonField tall />
          <Skeleton className="h-11 w-full sm:w-40" />
        </SkeletonCard>
      </div>
    </LoadingRegion>
  );
}
