import { unstable_rethrow } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Pager } from "@/components/ui/pager";
import { FilterShell, ResultsRegion } from "@/components/ui/filter-shell";
import { timedRead } from "@/lib/db/timed";
import {
  getPolicyChoices,
  getPolicyPage,
  getRecentPolicyChanges,
  type PolicyChangeView,
  type PolicyChoices,
  type PolicyPage,
} from "@/lib/leave/policies";
import type { PolicyListQuery } from "@/lib/leave/policies-schema";
import { requireDb } from "@/lib/leave/service";
import { logger } from "@/lib/logger";
import { describeChange, formatWhen } from "./policy-format";
import {
  PolicyEmpty,
  PolicyListError,
  PolicyNoMatches,
  RecentChangesError,
} from "./policies-states";
import { PolicyFilters } from "./policy-filters";
import { PolicySummaryTiles } from "./policy-summary";
import { PolicyTable } from "./policy-table";
import { clearedHref, policiesHref } from "./policies-url";

const NO_CHOICES: PolicyChoices = { managers: [], leaveTypes: [] };

/**
 * The summary tiles, the search and filters, and the employees: a table from `xl`, cards below. TWO
 * statements in parallel (the page of employees with its summary, and what the filters offer), both
 * scoped to the session user's id (the reads return nothing unless that user is an hr_admin). If the
 * page cannot be read the section says so with a way to retry instead of sending the whole page to the
 * error page; if only the filter choices cannot be read the list still works, without those two lists.
 */
export async function PolicyListSection({
  viewerId,
  query,
  timeZone,
}: {
  viewerId: string;
  query: PolicyListQuery;
  timeZone: string;
}) {
  let data: PolicyPage;
  let choices: PolicyChoices;
  try {
    const sql = requireDb();
    const [page, found] = await Promise.all([
      timedRead("policies.list", () => getPolicyPage(sql, { ...query, viewerId, timeZone })),
      timedRead("policies.choices", () => getPolicyChoices(sql, viewerId)).catch(
        (err: unknown): null => {
          unstable_rethrow(err);
          logger.warn({ err }, "policies: filter choices unavailable");
          return null;
        },
      ),
    ]);
    data = page;
    choices = found ?? NO_CHOICES;
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err }, "policies: list unavailable");
    return <PolicyListError retryHref={policiesHref(query, query.page)} />;
  }

  const filtered = Boolean(query.q || query.team || query.type || query.status);
  const address = policiesHref(query, query.page);

  return (
    <FilterShell>
      <div className="space-y-6">
        <PolicySummaryTiles summary={data.summary} />
        <PolicyFilters query={query} choices={choices} />
        <ResultsRegion>
          <Card title={`Employees (${data.total.toLocaleString("en-US")})`}>
            {data.total === 0 ? (
              filtered ? (
                <PolicyNoMatches q={query.q} clearHref={clearedHref(query)} />
              ) : (
                <PolicyEmpty />
              )
            ) : (
              <>
                <PolicyTable key={address} people={data.people} query={query} timeZone={timeZone} />
                <Pager
                  page={data.page}
                  total={data.total}
                  pageSize={data.pageSize}
                  hrefFor={(page) => policiesHref(query, page)}
                />
              </>
            )}
          </Card>
        </ResultsRegion>
      </div>
    </FilterShell>
  );
}

/** The latest changes (who, whom, which rate). A failure is a note; the list still works. */
export async function RecentChangesSection({
  viewerId,
  timeZone,
}: {
  viewerId: string;
  timeZone: string;
}) {
  let changes: PolicyChangeView[];
  try {
    changes = await timedRead("policies.recent", () =>
      getRecentPolicyChanges(requireDb(), viewerId),
    );
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err }, "policies: recent changes unavailable");
    return <RecentChangesError />;
  }

  return (
    <Card title="Recent changes">
      {changes.length === 0 ? (
        <p className="text-ink-muted">No rate has been changed yet.</p>
      ) : (
        <ul aria-label="Recent rate changes" className="divide-y divide-line">
          {changes.map((c) => (
            <li key={c.id} className="py-3 first:pt-0 last:pb-0">
              <p className="break-words text-ink [overflow-wrap:anywhere]">{describeChange(c)}</p>
              <p className="text-sm text-ink-muted">{formatWhen(c.changedAt, timeZone)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
