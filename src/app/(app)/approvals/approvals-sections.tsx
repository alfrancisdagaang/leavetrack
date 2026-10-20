import { unstable_rethrow } from "next/navigation";
import { FilterShell, ResultsRegion } from "@/components/ui/filter-shell";
import { Pager } from "@/components/ui/pager";
import { StatTiles } from "@/components/ui/stat-tiles";
import { timedRead } from "@/lib/db/timed";
import type { ListPage } from "@/lib/leave/list-query";
import { requireDb } from "@/lib/leave/service";
import type { DecidedTeamRequestView, TeamRequestView } from "@/lib/leave/team";
import {
  getTeamChoices,
  getTeamDecidedPage,
  getTeamQueuePage,
  type TeamChoices,
  type TeamDecidedSummary,
  type TeamPendingSummary,
} from "@/lib/leave/team-lists";
import type { TeamQueueQuery } from "@/lib/leave/team-queue-schema";
import { logger } from "@/lib/logger";
import { ApprovalsFilters } from "./approvals-filters";
import { DecidedEmpty, PendingEmpty } from "./approvals-states";
import { approvalsHref, clearedHref } from "./approvals-url";
import { DecidedList } from "./decided-table";
import { ListError, ListNoMatches, ResultsCard } from "./list-parts";
import { PendingList } from "./pending-table";

const NO_CHOICES: TeamChoices = { leaveTypes: [] };

type Page =
  | ListPage<TeamRequestView, TeamPendingSummary>
  | ListPage<DecidedTeamRequestView, TeamDecidedSummary>;

/**
 * Team Approvals' list for the open view (EPIC-14): tiles, search and filters, and the pending or decided
 * requests as a table (cards on a phone) with a pager. TWO statements in parallel (the page of requests with
 * its tiles, and what the filters offer), both scoped to the session manager's id (the reads return nothing
 * unless that user is a manager, and only their direct reports' requests). If the page cannot be read the
 * section says so with a way to retry instead of sending the whole page to the error page; if only the filter
 * choices cannot be read the list still works, without the leave type list.
 */
export async function ApprovalsSection({
  managerId,
  query,
  now,
  timeZone,
}: {
  managerId: string;
  query: TeamQueueQuery;
  now: Date;
  timeZone: string;
}) {
  let data: Page;
  let choices: TeamChoices;
  try {
    const sql = requireDb();
    const [page, found] = await Promise.all([
      query.view === "pending"
        ? timedRead("approvals.queue", () => getTeamQueuePage(sql, { ...query, managerId }))
        : timedRead("approvals.decided", () => getTeamDecidedPage(sql, { ...query, managerId })),
      timedRead("approvals.choices", () => getTeamChoices(sql, managerId)).catch(
        (err: unknown): null => {
          unstable_rethrow(err);
          logger.warn({ err }, "approvals: filter choices unavailable");
          return null;
        },
      ),
    ]);
    data = page;
    choices = found ?? NO_CHOICES;
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err, view: query.view }, "approvals: list unavailable");
    return (
      <ListError
        what={query.view === "pending" ? "Pending requests" : "Decided requests"}
        retryHref={approvalsHref(query, query.page)}
      />
    );
  }

  const filtered = Boolean(query.q || query.type || query.status || query.from || query.to);
  const pending = query.view === "pending";
  const tiles = pending
    ? (() => {
        const s = (data as ListPage<TeamRequestView, TeamPendingSummary>).summary;
        return [
          { icon: "/icons/clock-3.svg", tint: "bg-pending-bg", value: s.pending, label: "pending" },
          {
            icon: "/icons/check-success.svg",
            tint: "bg-approved-bg",
            value: s.canApprove,
            label: "you can approve now",
            href: approvalsHref({
              ...query,
              q: undefined,
              type: undefined,
              from: undefined,
              to: undefined,
              status: "ok",
            }),
          },
          {
            icon: "/icons/triangle-alert.svg",
            tint: "bg-rejected-bg",
            value: s.cannotApprove,
            label: "can't be approved yet",
          },
        ];
      })()
    : (() => {
        const s = (data as ListPage<DecidedTeamRequestView, TeamDecidedSummary>).summary;
        const link = (status: "approved" | "rejected" | "overridden") =>
          approvalsHref({
            ...query,
            q: undefined,
            type: undefined,
            from: undefined,
            to: undefined,
            status,
          });
        return [
          {
            icon: "/icons/check-success.svg",
            tint: "bg-approved-bg",
            value: s.approved,
            label: "approved",
            href: link("approved"),
          },
          {
            icon: "/icons/circle-alert.svg",
            tint: "bg-rejected-bg",
            value: s.rejected,
            label: "rejected",
            href: link("rejected"),
          },
          {
            icon: "/icons/triangle-alert.svg",
            tint: "bg-pending-bg",
            value: s.overridden,
            label: "HR overrides",
            href: link("overridden"),
          },
        ];
      })();
  const address = approvalsHref(query, query.page);

  return (
    <FilterShell>
      <div className="space-y-6">
        <StatTiles tiles={tiles} label="Summary" />
        <ApprovalsFilters query={query} leaveTypes={choices.leaveTypes} />
        <ResultsRegion>
          <ResultsCard
            title={`${pending ? "Pending requests" : "Decided requests"} (${data.total.toLocaleString("en-US")})`}
          >
            {data.total === 0 ? (
              filtered ? (
                <ListNoMatches
                  clearHref={clearedHref(query)}
                  what={pending ? "pending requests" : "decided requests"}
                />
              ) : pending ? (
                <PendingEmpty />
              ) : (
                <DecidedEmpty />
              )
            ) : (
              <>
                {pending ? (
                  <PendingList
                    key={address}
                    rows={(data as ListPage<TeamRequestView, TeamPendingSummary>).rows}
                    query={query}
                    now={now}
                    timeZone={timeZone}
                  />
                ) : (
                  <DecidedList
                    key={address}
                    rows={(data as ListPage<DecidedTeamRequestView, TeamDecidedSummary>).rows}
                    query={query}
                    now={now}
                    timeZone={timeZone}
                  />
                )}
                <Pager
                  page={data.page}
                  total={data.total}
                  pageSize={data.pageSize}
                  hrefFor={(page) => approvalsHref(query, page)}
                />
              </>
            )}
          </ResultsCard>
        </ResultsRegion>
      </div>
    </FilterShell>
  );
}
