import { LoadingRegion, SkeletonHeader } from "@/components/ui/skeleton";
import { CalendarSkeleton } from "./calendar-skeleton";

/** Mirrors the HR calendar: the header, then the filter card and the month. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <CalendarSkeleton />
    </LoadingRegion>
  );
}
