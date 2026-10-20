import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingRegion } from "@/components/ui/skeleton";
import { ViewTabs } from "@/components/ui/view-tabs";
import { requireRole } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { parseOverrideListQuery } from "@/lib/leave/override-list-schema";
import { ApprovalsSkeleton } from "../approvals-skeleton";
import { OverridesSection } from "./override-sections";
import { viewHref } from "./overrides-url";

export const metadata: Metadata = { title: "Balance Overrides" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * PRD US-01 AC3 (TASK-039, EPIC-14). HR Admins only (everyone else is sent to the dashboard): the pending
 * requests that ask for more days than the balance, from every team, with Approve override and Reject, and the
 * overrides already approved as a second view, each with a search, filters, sorting and pages. The layout is not
 * a security boundary, so the role is checked here; the decision itself goes through the TASK-038 route, which
 * checks it again, and the reads check it in SQL. The view, search, filters and page live in the address, so
 * the form is a plain GET form that also works without JavaScript.
 */
export default async function OverridesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user } = await requireRole("hr_admin");
  const { query, ignored } = parseOverrideListQuery(await searchParams);
  const timeZone = getEnv().APP_TIMEZONE ?? "UTC";
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Balance Overrides"
        description={
          query.view === "waiting"
            ? "Leave requests that ask for more days than the balance. Approving uses up the balance; rejecting needs a reason."
            : "Leave requests HR approved over the balance, with the shortfall recorded in the audit history."
        }
      />
      <ViewTabs
        label="Balance overrides views"
        active={query.view}
        tabs={[
          { key: "waiting", label: "Waiting", href: viewHref("waiting") },
          { key: "overridden", label: "Overridden", href: viewHref("overridden") },
        ]}
      />
      {ignored.length > 0 ? (
        <div className="mb-4">
          <Alert variant="info">
            {`These values in the address were not valid and were ignored: ${ignored.join(", ")}.`}
          </Alert>
        </div>
      ) : null}
      <Suspense
        fallback={
          <LoadingRegion>
            <ApprovalsSkeleton />
          </LoadingRegion>
        }
      >
        <OverridesSection hrId={user.id} query={query} now={now} timeZone={timeZone} />
      </Suspense>
    </div>
  );
}
