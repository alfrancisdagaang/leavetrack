import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingRegion } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { OverrideCardSkeleton } from "./override-skeleton";
import { OverrideQueueSection, RecentOverridesSection } from "./override-sections";

export const metadata: Metadata = { title: "Balance Overrides" };
export const dynamic = "force-dynamic";

/**
 * PRD US-01 AC3 (TASK-039). HR Admins only (everyone else is sent to the dashboard): the pending
 * requests that ask for more days than the balance, from every team, with Approve override and
 * Reject, then the latest overrides. The layout is not a security boundary, so the role is
 * checked here; the decision itself goes through the TASK-038 route, which checks it again.
 */
export default async function OverridesPage() {
  const { user } = await requireRole("hr_admin");
  const timeZone = getEnv().APP_TIMEZONE ?? "UTC";
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Balance Overrides"
        description="Leave requests that ask for more days than the balance. Approving uses up the balance; rejecting needs a reason."
      />
      <div className="space-y-8">
        <Suspense
          fallback={
            <LoadingRegion>
              <OverrideCardSkeleton rows={2} />
            </LoadingRegion>
          }
        >
          <OverrideQueueSection hrId={user.id} />
        </Suspense>
        <Suspense
          fallback={
            <LoadingRegion>
              <OverrideCardSkeleton rows={2} />
            </LoadingRegion>
          }
        >
          <RecentOverridesSection now={now} timeZone={timeZone} />
        </Suspense>
      </div>
    </div>
  );
}
