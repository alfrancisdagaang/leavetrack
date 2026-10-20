import { unstable_rethrow } from "next/navigation";
import { FilterShell, ResultsRegion } from "@/components/ui/filter-shell";
import { Pager } from "@/components/ui/pager";
import { StatTiles } from "@/components/ui/stat-tiles";
import { timedRead } from "@/lib/db/timed";
import type { ListPage } from "@/lib/leave/list-query";
import type { OverrideListQuery } from "@/lib/leave/override-list-schema";
import {
  getOverrideChoices,
  getOverriddenPage,
  getOverrideQueuePage,
  type OverrideChoices,
  type OverriddenSummary,
  type OverrideWaitingSummary,
} from "@/lib/leave/override-lists";
import type { OverrideQueueRow, RecentOverrideView } from "@/lib/leave/override-queue";
import { requireDb } from "@/lib/leave/service";
import { logger } from "@/lib/logger";
import { ListError, ListNoMatches, ResultsCard } from "../list-parts";
import { OverriddenList, WaitingList } from "./override-table";
import { OverridesFilters } from "./overrides-filters";
import { OverriddenEmpty, WaitingEmpty } from "./overrides-states";
import { clearedHref, overridesHref } from "./overrides-url";

const NO_CHOICES: OverrideChoices = { leaveTypes: [], managers: [] };

type Waiting = ListPage<OverrideQueueRow, OverrideWaitingSummary>;
type Done = ListPage<RecentOverrideView, OverriddenSummary>;

/**
 * Balance Overrides' list for the open view (EPIC-14): tiles, search and filters, and the requests waiting for
 * HR (or the ones already overridden) as a table (cards on a phone) with a pager. TWO statements in parallel (the
 * page with its tiles, and what the filters offer), both for the session user, who must be an hr_admin (the reads
 * return nothing otherwise). The old cap of 50 is gone: HR can page to every waiting request. If the page cannot
 * be read the section says so with a way to retry instead of sending the whole page to the error page; if only
 * the filter choices cannot be read the list still works, without the leave type and team lists.
 */
export async function OverridesSection({
  hrId,
  query,
  now,
  timeZone,
}: {
  hrId: string;
  query: OverrideListQuery;
  now: Date;
  timeZone: string;
}) {
  let data: Waiting | Done;
  let choices: OverrideChoices;
  try {
    const sql = requireDb();
    const [page, found] = await Promise.all([
      query.view === "waiting"
        ? timedRead("overrides.queue", () => getOverrideQueuePage(sql, { ...query, hrId }))
        : timedRead("overrides.done", () => getOverriddenPage(sql, { ...query, hrId, timeZone })),
      timedRead("overrides.choices", () => getOverrideChoices(sql, hrId)).catch(
        (err: unknown): null => {
          unstable_rethrow(err);
          logger.warn({ err }, "overrides: filter choices unavailable");
          return null;
        },
      ),
    ]);
    data = page;
    choices = found ?? NO_CHOICES;
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err, view: query.view }, "overrides: list unavailable");
    return (
      <ListError
        what={query.view === "waiting" ? "Override requests" : "Overridden requests"}
        retryHref={overridesHref(query, query.page)}
      />
    );
  }

  const waiting = query.view === "waiting";
  const filtered = Boolean(query.q || query.type || query.team || query.from || query.to);
  const num = (text: string | null) => (text === null ? 0 : Number(text));
  const tiles = waiting
    ? (() => {
        const s = (data as Waiting).summary;
        return [
          {
            icon: "/icons/triangle-alert.svg",
            tint: "bg-pending-bg",
            value: s.waiting,
            label: "waiting for an override",
          },
          {
            icon: "/icons/circle-alert.svg",
            tint: "bg-rejected-bg",
            value: num(s.biggestShortfall),
            label: "days over balance at most",
          },
          {
            icon: "/icons/clock-3.svg",
            tint: "bg-brand-50",
            value: s.oldestDays ?? 0,
            label: "days since the oldest request",
          },
        ];
      })()
    : (() => {
        const s = (data as Done).summary;
        return [
          {
            icon: "/icons/check-success.svg",
            tint: "bg-approved-bg",
            value: s.total,
            label: "overrides approved",
          },
          {
            icon: "/icons/triangle-alert.svg",
            tint: "bg-pending-bg",
            value: num(s.totalShortfall),
            label: "days over balance in total",
          },
          {
            icon: "/icons/clock-3.svg",
            tint: "bg-brand-50",
            value: s.thisMonth,
            label: "approved this month",
          },
        ];
      })();
  const address = overridesHref(query, query.page);

  return (
    <FilterShell>
      <div className="space-y-6">
        <StatTiles tiles={tiles} label="Summary" />
        <OverridesFilters query={query} choices={choices} />
        <ResultsRegion>
          <ResultsCard
            title={`${waiting ? "Waiting for an override" : "Overridden requests"} (${data.total.toLocaleString("en-US")})`}
          >
            {data.total === 0 ? (
              filtered ? (
                <ListNoMatches
                  clearHref={clearedHref(query)}
                  what={waiting ? "requests waiting for an override" : "overridden requests"}
                />
              ) : waiting ? (
                <WaitingEmpty />
              ) : (
                <OverriddenEmpty />
              )
            ) : (
              <>
                {waiting ? (
                  <WaitingList
                    key={address}
                    rows={(data as Waiting).rows}
                    query={query}
                    now={now}
                    timeZone={timeZone}
                  />
                ) : (
                  <OverriddenList
                    key={address}
                    rows={(data as Done).rows}
                    query={query}
                    now={now}
                    timeZone={timeZone}
                  />
                )}
                <Pager
                  page={data.page}
                  total={data.total}
                  pageSize={data.pageSize}
                  hrefFor={(page) => overridesHref(query, page)}
                />
              </>
            )}
          </ResultsCard>
        </ResultsRegion>
      </div>
    </FilterShell>
  );
}
