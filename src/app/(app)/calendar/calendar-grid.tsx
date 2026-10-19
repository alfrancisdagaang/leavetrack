import Image from "next/image";
import Link from "next/link";
import type { IsoDate, MonthRef } from "@/lib/leave/calendar-layout";
import type { HrDayCount } from "@/lib/leave/hr-calendar";
import {
  longDay,
  outText,
  pendingText,
  typeText,
  weekdayName,
  weekdayWeeks,
} from "@/lib/leave/hr-calendar-layout";
import type { HrCalendarQuery } from "@/lib/leave/schemas";
import { calendarHref } from "./calendar-url";

const HEADERS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

type Props = {
  month: MonthRef;
  counts: readonly HrDayCount[];
  today: IsoDate;
  query: HrCalendarQuery;
  /** The leave types to list on every day (all of them, or the one the filter picked). */
  typeNames: readonly string[];
};

/** What a day shows, as text: how many are out, per leave type, and how many are still pending. */
function DayFigures({
  count,
  typeNames,
}: {
  count: HrDayCount | undefined;
  typeNames: readonly string[];
}) {
  const types = typeText(count, typeNames);
  const pending = pendingText(count);
  return (
    <>
      <span className="block text-sm font-semibold text-ink">{outText(count)}</span>
      {types ? <span className="block text-xs text-ink-muted">{types}</span> : null}
      {pending ? (
        <span
          className={`block text-xs ${count && count.pending > 0 ? "text-pending-fg" : "text-ink-muted"}`}
        >
          {pending}
        </span>
      ) : null}
    </>
  );
}

function cellClasses(selected: boolean, today: boolean): string {
  const base = "block min-h-24 rounded-lg border p-2 text-left";
  const tone = selected
    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500"
    : today
      ? "border-brand-500 bg-brand-50"
      : "border-line bg-white";
  return `${base} ${tone}`;
}

/**
 * EPIC-7. The month as a Monday-to-Friday grid (from `sm`) and as a list of the days somebody is
 * out (below `sm`). One count per day, never a bar per person. A day with people out is a link that
 * opens the list of who is out; today and the open day are marked in words, not only by colour.
 */
export function CalendarGrid({ month, counts, today, query, typeNames }: Props) {
  const byDay = new Map(counts.map((c) => [c.day, c]));
  const weeks = weekdayWeeks(month);
  const open = (day: IsoDate) => calendarHref(query, { day, q: undefined, page: 1 });
  const marks = (day: IsoDate) => (
    <>
      {day === today ? (
        <span className="rounded bg-brand-500 px-1.5 text-xs font-semibold text-white">Today</span>
      ) : null}
      {day === query.day ? (
        <span className="rounded border border-brand-500 px-1.5 text-xs font-semibold text-brand-600">
          Open
        </span>
      ) : null}
    </>
  );

  return (
    <div>
      {/* sm and up: the grid */}
      <div className="hidden sm:block">
        <div className="mb-2 grid grid-cols-5 gap-2" aria-hidden="true">
          {HEADERS.map((name) => (
            <p key={name} className="px-1 text-sm font-medium text-ink-muted">
              {name}
            </p>
          ))}
        </div>
        <div className="space-y-2">
          {weeks.map((week) => (
            <div key={week.find(Boolean) ?? "empty"} className="grid grid-cols-5 gap-2">
              {week.map((day, i) => {
                if (!day) {
                  return (
                    <div key={`blank-${i}`} aria-hidden="true" className="rounded-lg bg-grey-100" />
                  );
                }
                const count = byDay.get(day);
                const head = (
                  <span className="mb-1 flex flex-wrap items-center gap-1">
                    <span className="text-sm font-semibold text-ink">
                      {Number(day.slice(8, 10))}
                    </span>
                    {marks(day)}
                    <span className="sr-only">{longDay(day)}</span>
                  </span>
                );
                return count && count.total > 0 ? (
                  <Link
                    key={day}
                    href={open(day)}
                    prefetch={false}
                    scroll={false}
                    aria-current={day === today ? "date" : undefined}
                    className={`${cellClasses(day === query.day, day === today)} hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`}
                  >
                    {head}
                    <DayFigures count={count} typeNames={typeNames} />
                  </Link>
                ) : (
                  <div
                    key={day}
                    aria-current={day === today ? "date" : undefined}
                    className={cellClasses(false, day === today)}
                  >
                    {head}
                    <DayFigures count={undefined} typeNames={typeNames} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* below sm: only the days somebody is out */}
      <ul className="space-y-2 sm:hidden" aria-label="Days with people out">
        {counts
          .filter((c) => c.total > 0)
          .map((count) => (
            <li key={count.day}>
              <Link
                href={open(count.day)}
                prefetch={false}
                scroll={false}
                aria-current={count.day === today ? "date" : undefined}
                className={`${cellClasses(count.day === query.day, count.day === today)} flex min-h-11 items-start gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`}
              >
                <span className="w-12 shrink-0">
                  <span className="block text-xs text-ink-muted">{weekdayName(count.day)}</span>
                  <span className="block text-lg font-semibold text-ink">
                    {Number(count.day.slice(8, 10))}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mb-0.5 flex flex-wrap items-center gap-1">
                    {marks(count.day)}
                    <span className="sr-only">{longDay(count.day)}</span>
                  </span>
                  <DayFigures count={count} typeNames={typeNames} />
                </span>
                <Image
                  src="/icons/chevron-right.svg"
                  alt=""
                  width={16}
                  height={16}
                  unoptimized
                  className="mt-1 shrink-0"
                />
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
