import { unstable_rethrow } from "next/navigation";
import { timedRead } from "@/lib/db/timed";
import { monthBounds, orderTypeNames } from "@/lib/leave/hr-calendar-layout";
import {
  getDayPeople,
  getHrCalendarChoices,
  getMonthCounts,
  type HrDayPage,
} from "@/lib/leave/hr-calendar";
import { monthOf, parseMonthParam, type IsoDate } from "@/lib/leave/calendar-layout";
import type { HrCalendarQuery } from "@/lib/leave/schemas";
import { requireDb } from "@/lib/leave/service";
import { logger } from "@/lib/logger";
import { CalendarFilters } from "./calendar-filters";
import { CalendarGrid } from "./calendar-grid";
import { CalendarEmpty, CalendarError } from "./calendar-states";
import { DayDialog } from "./day-dialog";
import { DayPanel } from "./day-panel";
import { calendarHref } from "./calendar-url";

/**
 * EPIC-7. The filters, the month and, when a day is open, who is out that day. At most three reads
 * run in parallel (the choices, the month and the day), so the page stays inside the pool budget.
 * If a read fails the section says so with a way to retry, instead of sending the whole page to the
 * error page. Streams in under the header.
 */
export async function CalendarBody({
  viewerId,
  query,
  today,
}: {
  viewerId: string;
  query: HrCalendarQuery;
  today: IsoDate;
}) {
  const month = parseMonthParam(query.month, today);
  const { from, to } = monthBounds(month);
  const filters = { managerId: query.managerId, leaveTypeId: query.leaveTypeId };

  let data;
  try {
    const sql = requireDb();
    data = await Promise.all([
      timedRead("hr_calendar.choices", () => getHrCalendarChoices(sql, { viewerId })),
      timedRead("hr_calendar.month", () => getMonthCounts(sql, { viewerId, from, to, ...filters })),
      query.day
        ? timedRead("hr_calendar.day", () =>
            getDayPeople(sql, {
              viewerId,
              day: query.day!,
              q: query.q,
              page: query.page,
              ...filters,
            }),
          )
        : Promise.resolve<HrDayPage | null>(null),
    ]);
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err }, "hr calendar: unavailable");
    return <CalendarError retryHref={calendarHref(query)} />;
  }
  const [choices, counts, list] = data;
  const anyone = counts.some((c) => c.total > 0);
  const filtered = Boolean(query.managerId || query.leaveTypeId);
  const typeNames = orderTypeNames(
    choices.leaveTypes
      .filter((t) => !query.leaveTypeId || t.id === query.leaveTypeId)
      .map((t) => t.name),
  );

  return (
    <div>
      <CalendarFilters query={query} month={month} todayMonth={monthOf(today)} choices={choices} />
      {anyone ? (
        <div>
          <CalendarGrid
            month={month}
            counts={counts}
            today={today}
            query={query}
            typeNames={typeNames}
          />
          <p className="mt-3 text-center text-sm text-ink-muted">
            Totals count people with an approved or pending request. Weekends are not shown.
          </p>
          {query.day && list ? (
            <DayDialog closeHref={calendarHref(query, { day: undefined, q: undefined, page: 1 })}>
              <DayPanel
                query={query}
                day={query.day}
                list={list}
                people={counts.find((c) => c.day === query.day)?.total ?? 0}
                count={counts.find((c) => c.day === query.day)}
                typeNames={typeNames}
              />
            </DayDialog>
          ) : null}
        </div>
      ) : (
        <CalendarEmpty
          filtered={filtered}
          clearHref={calendarHref(query, {
            managerId: undefined,
            leaveTypeId: undefined,
            day: undefined,
            q: undefined,
            page: 1,
          })}
        />
      )}
    </div>
  );
}
