import { LoadingRegion } from "@/components/ui/skeleton";
import { MemberSkeleton } from "./member-skeleton";

/** Mirrors the team member page. */
export default function Loading() {
  return (
    <LoadingRegion>
      <MemberSkeleton />
    </LoadingRegion>
  );
}
