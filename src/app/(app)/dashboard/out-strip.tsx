import Link from "next/link";
import type { IsoDate } from "@/lib/leave/calendar-layout";
import { longDay } from "@/lib/leave/hr-calendar-layout";
import type { OutDay } from "@/lib/leave/out-figures";

/**
 * The HR dashboard's "Next 7 days": how many people are out on each weekday of the coming week,
 * written as text, with a link into the Company Calendar. A day with people out opens that day's
 * list there; a day with nobody is not a link. Presentational: the figures arrive as props.
 */
export function OutStrip({ days, today }: { days: readonly OutDay[]; today: IsoDate }) {
  return (
    <section
      aria-labelledby="out-strip-heading"
      className="rounded-tile bg-white p-5 shadow-tile sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="out-strip-heading" className="text-base font-semibold text-ink">
            Next 7 days
          </h2>
          <p className="text-sm text-ink-muted">
            People out each weekday, approved or pending, across the company.
          </p>
        </div>
        <Link
          href="/calendar"
          prefetch={false}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-600 hover:underline"
        >
          Open Company Calendar
        </Link>
      </div>
      {days.length === 0 ? (
        <p className="text-sm text-ink-muted">There are no weekdays to show.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 [&>li:last-child:nth-child(odd)]:col-span-2 sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] sm:[&>li:last-child:nth-child(odd)]:col-span-1">
          {days.map((day) => {
            const body = (
              <>
                <span className="flex flex-wrap items-center gap-1 text-xs font-medium text-ink-muted">
                  {longDay(day.day).replace(/ \d{4}$/, "")}
                  {day.day === today ? (
                    <span className="rounded bg-brand-500 px-1.5 text-xs font-semibold text-white">
                      Today
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-lg font-semibold text-ink">
                  {day.total === 0 ? "No one out" : `${day.total} out`}
                </span>
                {day.total > 0 ? (
                  <span
                    className={`block text-xs ${day.pending > 0 ? "text-pending-fg" : "text-ink-muted"}`}
                  >
                    {`${day.pending} pending`}
                  </span>
                ) : null}
              </>
            );
            const box = "block min-h-20 rounded-lg border p-3";
            return (
              <li key={day.day}>
                {day.total > 0 ? (
                  <Link
                    href={`/calendar?month=${day.day.slice(0, 7)}&day=${day.day}`}
                    prefetch={false}
                    aria-current={day.day === today ? "date" : undefined}
                    className={`${box} ${day.day === today ? "border-brand-500 bg-brand-50" : "border-line bg-white"} hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`}
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    aria-current={day.day === today ? "date" : undefined}
                    className={`${box} ${day.day === today ? "border-brand-500 bg-brand-50" : "border-line bg-white"}`}
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
