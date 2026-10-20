import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingRegion } from "@/components/ui/skeleton";
import { ViewTabs } from "@/components/ui/view-tabs";
import { requireRole } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { parseTeamQueueQuery } from "@/lib/leave/team-queue-schema";
import { ApprovalsSection } from "./approvals-sections";
import { ApprovalsSkeleton } from "./approvals-skeleton";
import { viewHref } from "./approvals-url";

export const metadata: Metadata = { title: "Team Approvals" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * US-03 / US-04. Team Approvals: the pending requests from the signed-in manager's direct reports, and the
 * decided ones as a second view, each with a search, filters, sorting and pages (EPIC-14). Managers only
 * (EPIC-10); the real scope is in the SQL. The header and tabs show at once; the list streams in. The view,
 * search, filters and page live in the address, so the form is a plain GET form that also works without
 * JavaScript.
 */
export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user } = await requireRole("manager");
  const { query, ignored } = parseTeamQueueQuery(await searchParams);
  const timeZone = getEnv().APP_TIMEZONE ?? "UTC";
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Team Approvals"
        description={
          query.view === "pending"
            ? "Pending leave requests from your direct reports."
            : "Leave requests from your direct reports that have been decided."
        }
      />
      <ViewTabs
        label="Team approvals views"
        active={query.view}
        tabs={[
          { key: "pending", label: "Pending", href: viewHref("pending") },
          { key: "decided", label: "Decided", href: viewHref("decided") },
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
        <ApprovalsSection managerId={user.id} query={query} now={now} timeZone={timeZone} />
      </Suspense>
    </div>
  );
}
