import { LoadingRegion, SkeletonHeader } from "@/components/ui/skeleton";
import { RosterSkeleton } from "./roster-skeleton";

/** Mirrors My Team: the header, then a row per direct report. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <RosterSkeleton />
    </LoadingRegion>
  );
}
