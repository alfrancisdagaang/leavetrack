import { LoadingRegion, SkeletonHeader } from "@/components/ui/skeleton";
import { AuditSkeleton } from "./audit-skeleton";

/** Mirrors the audit log: the header, then the filter card, the summary and the rows. */
export default function Loading() {
  return (
    <LoadingRegion>
      <SkeletonHeader />
      <AuditSkeleton />
    </LoadingRegion>
  );
}
