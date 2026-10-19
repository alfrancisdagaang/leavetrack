import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingRegion } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/guards";
import { DecidedSection, PendingSection } from "./approvals-sections";
import { DecidedSkeleton, PendingSkeleton } from "./approvals-skeleton";

export const metadata: Metadata = { title: "Team Approvals" };
export const dynamic = "force-dynamic";

/**
 * US-03 / US-04. Team Approvals: pending requests from the signed-in manager's
 * direct reports, and the team's recent decisions. Managers only (EPIC-10); the real scope is
 * in the SQL. The header shows at once; the two lists stream in on their own.
 */
export default async function ApprovalsPage() {
  const { user } = await requireRole("manager");

  return (
    <div>
      <PageHeader
        title="Team Approvals"
        description="Pending leave requests from your direct reports."
      />
      <div className="space-y-8">
        <Suspense
          fallback={
            <LoadingRegion>
              <PendingSkeleton />
            </LoadingRegion>
          }
        >
          <PendingSection managerId={user.id} />
        </Suspense>
        <Suspense
          fallback={
            <LoadingRegion>
              <DecidedSkeleton />
            </LoadingRegion>
          }
        >
          <DecidedSection managerId={user.id} />
        </Suspense>
      </div>
    </div>
  );
}
