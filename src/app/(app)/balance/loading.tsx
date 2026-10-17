import { LoadingRegion, SkeletonHeader } from "@/components/ui/skeleton";
import { BalanceBodySkeleton } from "./balance-skeleton";

/** Mirrors My balance: header with an action, three balance cards, then the request list. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader action />
      <BalanceBodySkeleton />
    </LoadingRegion>
  );
}
