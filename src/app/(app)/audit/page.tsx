import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingRegion } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/guards";
import { parseAuditListQuery } from "@/lib/leave/schemas";
import { AuditBody } from "./audit-body";
import { AuditSkeleton } from "./audit-skeleton";

export const metadata: Metadata = { title: "Audit History" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * US-14 (US-05). HR's decision record across all employees, with filters, a summary and pages of 25.
 * HR admins only; HR may open any employee, so the role gate is the control. Read-only. The filters
 * live in the address, so the form is a plain GET form that also works without JavaScript. The header
 * shows at once and the results stream in.
 */
export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("hr_admin");
  const { query, ignored } = parseAuditListQuery(await searchParams);

  return (
    <div>
      <PageHeader
        title="Audit History"
        description="View the full history of leave requests, decisions, and actions. Records are never purged."
      />
      {ignored.length > 0 ? (
        <div className="mb-4">
          <Alert variant="info">
            {`These filters in the address were not valid and were ignored: ${ignored.join(", ")}.`}
          </Alert>
        </div>
      ) : null}
      <Suspense
        fallback={
          <LoadingRegion>
            <AuditSkeleton />
          </LoadingRegion>
        }
      >
        <AuditBody query={query} />
      </Suspense>
    </div>
  );
}
