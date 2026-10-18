import { LoadingRegion, SkeletonHeader } from "@/components/ui/skeleton";
import { TabsSkeleton } from "../approvals-skeleton";
import { RosterSkeleton } from "./roster-skeleton";

/** Mirrors My team: the header, the tabs, then a row per direct report. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <TabsSkeleton />
      <RosterSkeleton />
    </LoadingRegion>
  );
}
