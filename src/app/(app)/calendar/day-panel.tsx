import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { ButtonLink, Button } from "@/components/ui/button";
import { MemberPagination } from "@/app/(app)/approvals/team/[userId]/member-pagination";
import { formatRange } from "@/app/(app)/audit/audit-format";
import { HR_DAY_PAGE_SIZE, type HrDayCount, type HrDayPage } from "@/lib/leave/hr-calendar";
import { longDay, peopleOut } from "@/lib/leave/hr-calendar-layout";
import type { HrCalendarQuery } from "@/lib/leave/schemas";
import { calendarHref } from "./calendar-url";
import { DaySummary } from "./day-summary";

/**
 * EPIC-7. Who is out on the open day: name, team (manager), leave type, dates and a written status,
 * 25 to a page, with a name search. Never a reason or a note. A plain GET form and plain links, so it
 * works without JavaScript; closing it returns to the month with the same filters.
 */
export function DayPanel({
  query,
  day,
  list,
  people,
  count,
  typeNames,
}: {
  query: HrCalendarQuery;
  day: string;
  list: HrDayPage;
  /** People out that day, the figure the month shows (a person with two requests counts once). */
  people: number;
  /** The day's figures from the month (for the summary tiles). */
  count: HrDayCount | undefined;
  typeNames: readonly string[];
}) {
  const closeHref = calendarHref(query, { day: undefined, q: undefined, page: 1 });
  return (
    <section aria-labelledby="cal-day-heading" id="cal-day">
      <div>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="cal-day-heading" className="text-lg font-semibold text-ink">
            {`${longDay(day)} · ${peopleOut(people)}`}
          </h2>
          <ButtonLink
            href={closeHref}
            variant="secondary"
            prefetch={false}
            scroll={false}
            aria-label="Close"
            className="!min-h-10 !px-3"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </ButtonLink>
        </div>

        <DaySummary count={count} typeNames={typeNames} />

        <p className="mb-3 text-sm text-ink-muted">
          {`${list.total} request${list.total === 1 ? "" : "s"} ${query.q ? "match this name" : "listed"} (a person with two requests appears twice).`}
        </p>

        <form
          method="get"
          action="/calendar"
          aria-label="Search this day"
          className="mb-4 flex gap-2"
        >
          {query.month ? <input type="hidden" name="month" value={query.month} /> : null}
          {query.managerId ? <input type="hidden" name="team" value={query.managerId} /> : null}
          {query.leaveTypeId ? <input type="hidden" name="type" value={query.leaveTypeId} /> : null}
          <input type="hidden" name="day" value={day} />
          <label htmlFor="cal-day-q" className="sr-only">
            Search by name
          </label>
          <span className="relative block flex-1">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <Input
              className="pl-9"
              id="cal-day-q"
              name="q"
              type="search"
              maxLength={60}
              autoComplete="off"
              placeholder="Search by name…"
              defaultValue={query.q ?? ""}
            />
          </span>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        {list.total === 0 ? (
          <p className="py-4 text-center text-ink-muted">
            {query.q ? "Nobody out that day matches this name." : "Nobody is out on this day."}
          </p>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="hidden border-b border-line pb-2 text-xs font-medium text-ink-muted sm:grid sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5.5rem] sm:gap-x-4"
            >
              <span>Name · Team</span>
              <span>Leave type · Dates</span>
              <span className="justify-self-end">Status</span>
            </div>
            <ul aria-label={`People out on ${longDay(day)}`} className="divide-y divide-line">
              {list.people.map((p) => (
                <li
                  key={p.requestId}
                  className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 sm:grid sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5.5rem]"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium text-ink">{p.name}</p>
                    <p className="break-words text-sm text-ink-muted">
                      {p.managerName ? `Team: ${p.managerName}` : "No manager"}
                    </p>
                  </div>
                  <div className="text-sm text-ink">
                    <p>{p.leaveTypeName}</p>
                    <p className="text-ink-muted">{formatRange(p.startDate, p.endDate)}</p>
                  </div>
                  <span className="sm:justify-self-end">
                    <Badge variant={p.status === "approved" ? "approved" : "pending"}>
                      {p.status === "approved" ? "Approved" : "Pending"}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <MemberPagination
          page={list.page}
          total={list.total}
          pageSize={HR_DAY_PAGE_SIZE}
          hrefFor={(page) => calendarHref(query, { page })}
        />
      </div>
    </section>
  );
}
