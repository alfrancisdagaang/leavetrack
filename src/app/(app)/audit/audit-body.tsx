import { unstable_rethrow } from "next/navigation";
import { MemberPagination } from "@/app/(app)/approvals/team/[userId]/member-pagination";
import { FilterShell, ResultsRegion } from "@/components/ui/filter-shell";
import { timedRead } from "@/lib/db/timed";
import { getAuditFilterChoices, getAuditPage } from "@/lib/leave/audit-list";
import { AUDIT_PAGE_SIZE, type AuditListQuery } from "@/lib/leave/schemas";
import { requireDb } from "@/lib/leave/service";
import { logger } from "@/lib/logger";
import { AuditFilters } from "./audit-filters";
import { AuditEmpty, AuditError, AuditNoMatches } from "./audit-states";
import { AuditSummary } from "./audit-summary";
import { AuditTable } from "./audit-table";
import { auditHref } from "./audit-url";

/**
 * US-14. The filter card, the summary and the requests. Two reads run in parallel (the filter choices
 * and the page), so the page stays inside the pool budget. If either cannot be read the section says so
 * with a way to retry instead of sending the whole page to the error page. Streams in under the header.
 */
export async function AuditBody({ query }: { query: AuditListQuery }) {
  let data;
  try {
    const sql = requireDb();
    data = await Promise.all([
      timedRead("audit.choices", () => getAuditFilterChoices(sql)),
      timedRead("audit.list", () => getAuditPage(sql, query)),
    ]);
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err }, "audit: list unavailable");
    return <AuditError retryHref={auditHref(query, query.page)} />;
  }
  const [choices, list] = data;
  const filtered = Boolean(
    query.q || query.leaveTypeId || query.status || query.decidedBy || query.from || query.to,
  );

  return (
    <FilterShell>
      <AuditFilters query={query} choices={choices} />
      <ResultsRegion>
        <AuditSummary counts={list.counts} />
        {list.counts.total === 0 ? (
          filtered ? (
            <AuditNoMatches clearHref="/audit" />
          ) : (
            <AuditEmpty />
          )
        ) : (
          <AuditTable rows={list.rows} total={list.counts.total}>
            <MemberPagination
              page={list.page}
              total={list.counts.total}
              pageSize={AUDIT_PAGE_SIZE}
              hrefFor={(page) => auditHref(query, page)}
            />
          </AuditTable>
        )}
      </ResultsRegion>
    </FilterShell>
  );
}
