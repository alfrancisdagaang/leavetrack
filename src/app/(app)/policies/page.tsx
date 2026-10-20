import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingRegion } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { parsePolicyQuery } from "@/lib/leave/policies-schema";
import { PolicyListSkeleton } from "./policies-skeleton";
import { PolicyListSection, RecentChangesSection } from "./policies-sections";

export const metadata: Metadata = { title: "Leave Policies" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * EPIC-13 (TASK-072). HR Admins only (everyone else is sent to the dashboard): each employee's accrual
 * rate in days a month for each leave type that tracks a balance, editable in place, and the latest
 * changes. The layout is not a security boundary, so the role is checked here; the change itself goes
 * through `PUT /api/leave-policies`, which checks it again, and the reads check it in SQL. The search
 * and page live in the address (a plain GET form), so the page also works without JavaScript.
 */
export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user } = await requireRole("hr_admin");
  const { query, ignored } = parsePolicyQuery(await searchParams);
  const timeZone = getEnv().APP_TIMEZONE ?? "UTC";

  return (
    <div>
      <PageHeader
        title="Leave Policies"
        description="How many days each employee earns a month. A new rate applies from the next monthly accrual; months already accrued are not changed."
      />
      {ignored.length > 0 ? (
        <div className="mb-4">
          <Alert variant="info">
            {`These values in the address were not valid and were ignored: ${ignored.join(", ")}.`}
          </Alert>
        </div>
      ) : null}
      <div className="min-[1700px]:grid min-[1700px]:grid-cols-[minmax(0,1fr)_20rem] min-[1700px]:items-start min-[1700px]:gap-8">
        <div className="min-w-0">
          <Suspense
            fallback={
              <LoadingRegion>
                <PolicyListSkeleton rows={6} />
              </LoadingRegion>
            }
          >
            <PolicyListSection viewerId={user.id} query={query} timeZone={timeZone} />
          </Suspense>
        </div>
        <aside aria-label="Recent changes" className="mt-6 min-w-0 min-[1700px]:mt-0">
          <Suspense
            fallback={
              <LoadingRegion>
                <PolicyListSkeleton rows={3} />
              </LoadingRegion>
            }
          >
            <RecentChangesSection viewerId={user.id} timeZone={timeZone} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}
