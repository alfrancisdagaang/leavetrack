import Image from "next/image";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { monthKey, monthTitle, shiftMonth, type MonthRef } from "@/lib/leave/calendar-layout";
import type { HrCalendarChoices } from "@/lib/leave/hr-calendar";
import type { HrCalendarQuery } from "@/lib/leave/schemas";
import { calendarHref } from "./calendar-url";

function Chevron() {
  return (
    <Image
      src="/icons/chevron-down.svg"
      alt=""
      width={16}
      height={16}
      unoptimized
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
    />
  );
}

/**
 * EPIC-7. Month navigation and the team and leave type filters. A plain GET form (it works without
 * JavaScript): the month and the filters live in the address, and a change closes the open day. The
 * previous, next and today links keep the filters.
 */
export function CalendarFilters({
  query,
  month,
  todayMonth,
  choices,
}: {
  query: HrCalendarQuery;
  month: MonthRef;
  todayMonth: MonthRef;
  choices: HrCalendarChoices;
}) {
  const key = monthKey(month);
  const link = (ref: MonthRef) =>
    calendarHref(query, { month: monthKey(ref), day: undefined, q: undefined, page: 1 });
  const todayLink = calendarHref(query, {
    month: undefined,
    day: undefined,
    q: undefined,
    page: 1,
  });
  const filtered = Boolean(query.managerId || query.leaveTypeId);

  const fields = (
    <>
      <Field id="cal-team" label="Team">
        <div className="relative">
          <Select
            id="cal-team"
            name="team"
            defaultValue={query.managerId ?? ""}
            className="appearance-none pr-10"
          >
            <option value="">All teams</option>
            {choices.managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Chevron />
        </div>
      </Field>
      <Field id="cal-type" label="Leave type">
        <div className="relative">
          <Select
            id="cal-type"
            name="type"
            defaultValue={query.leaveTypeId ?? ""}
            className="appearance-none pr-10"
          >
            <option value="">All types</option>
            {choices.leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Chevron />
        </div>
      </Field>
    </>
  );

  const clearHref = calendarHref(query, {
    managerId: undefined,
    leaveTypeId: undefined,
    day: undefined,
    q: undefined,
    page: 1,
  });

  return (
    <section
      aria-labelledby="cal-filters-heading"
      className="mb-4 rounded-tile border border-brand-50 bg-white p-4 shadow-tile sm:p-6"
    >
      <h2 id="cal-filters-heading" className="sr-only">
        Month and filters
      </h2>
      <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <div role="group" aria-labelledby="cal-month-label">
          <p id="cal-month-label" className="mb-1.5 text-sm font-medium text-ink">
            Month
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink
              href={link(shiftMonth(month, -1))}
              variant="secondary"
              prefetch={false}
              aria-label={`Previous month, ${monthTitle(shiftMonth(month, -1))}`}
            >
              <span aria-hidden="true">‹</span>
            </ButtonLink>
            <p
              className="flex min-h-11 min-w-30 flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-line bg-white px-2 text-center text-sm font-semibold text-ink sm:min-w-44 sm:px-3 sm:text-base"
              aria-live="polite"
            >
              {monthTitle(month)}
            </p>
            <ButtonLink
              href={link(shiftMonth(month, 1))}
              variant="secondary"
              prefetch={false}
              aria-label={`Next month, ${monthTitle(shiftMonth(month, 1))}`}
            >
              <span aria-hidden="true">›</span>
            </ButtonLink>
            <ButtonLink
              href={todayLink}
              variant="secondary"
              prefetch={false}
              aria-current={key === monthKey(todayMonth) ? "date" : undefined}
            >
              Today
            </ButtonLink>
          </div>
        </div>

        <form method="get" action="/calendar" aria-label="Filter the calendar" className="contents">
          <input type="hidden" name="month" value={query.month ?? ""} disabled={!query.month} />
          {fields}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <Button type="submit" className="w-full sm:w-auto lg:px-8">
              Apply
            </Button>
            {filtered ? (
              <a
                href={clearHref}
                className="inline-flex min-h-11 items-center justify-center whitespace-nowrap text-sm font-medium text-brand-600 hover:underline"
              >
                Clear filters
              </a>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
