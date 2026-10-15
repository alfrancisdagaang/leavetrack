import Image from "next/image";
import Link from "next/link";
import { RejectedToggle } from "@/components/ui/rejected-toggle";
import type { UserRole } from "@/lib/db/types";
import {
  firstName,
  layoutWeek,
  monthGrid,
  monthKey,
  monthTitle,
  shiftMonth,
  summarizeOwners,
  type BarSegment,
  type CalendarRequest,
  type CalendarStatus,
  type IsoDate,
  type MonthRef,
} from "@/lib/leave/calendar-layout";

interface LeaveCalendarProps {
  role: UserRole;
  viewerId: string;
  month: MonthRef;
  /** The viewer's "today" (see APP_TIMEZONE), as an ISO date. */
  today: IsoDate;
  /** Null when the query failed: the calendar says so instead of showing an empty month. */
  requests: CalendarRequest[] | null;
  showRejected: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One colour per leave type, through the --leave-color variable the bar styles read. */
const TYPE_COLOR: Record<string, string> = {
  vacation: "[--leave-color:var(--color-leave-vacation)]",
  sick: "[--leave-color:var(--color-leave-sick)]",
  unpaid: "[--leave-color:var(--color-leave-unpaid)]",
};
const FALLBACK_COLOR = "[--leave-color:var(--color-ink-muted)]";

/** Solid = approved, striped = pending. Never colour alone: the bar also says the status in words. */
const STATUS_STYLE: Record<CalendarStatus, string> = {
  approved: "bg-(color:--leave-color) text-white",
  pending: "leave-stripes border border-(color:--leave-color) text-ink",
  rejected: "border border-dashed border-(color:--leave-color) bg-grey-100 text-ink-muted",
};
const STATUS_LABEL: Record<CalendarStatus, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
};
const STATUS_SHORT: Record<CalendarStatus, string> = {
  approved: "Appr.",
  pending: "Pend.",
  rejected: "Rej.",
};

const SUBTITLE: Record<UserRole, string> = {
  employee: "Your leave",
  manager: "You + your team",
  hr_admin: "Everyone",
};

const OTHERS_LABEL: Record<UserRole, string> = {
  employee: "Others",
  manager: "Team",
  hr_admin: "Everyone else",
};

function href(month: MonthRef | null, showRejected: boolean): string {
  const params = new URLSearchParams();
  if (month) params.set("month", monthKey(month));
  if (showRejected) params.set("rejected", "1");
  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

const dayLabel = (iso: IsoDate) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function roundedClass({ startsHere, endsHere }: BarSegment): string {
  if (startsHere && endsHere) return "rounded-[5px]";
  if (startsHere) return "rounded-l-[5px]";
  if (endsHere) return "rounded-r-[5px]";
  return "";
}

function Bar({ segment }: { segment: BarSegment }) {
  const { request } = segment;
  const typeKey = request.leaveTypeName.toLowerCase();
  return (
    <div
      title={`${request.userName}, ${request.leaveTypeName}, ${STATUS_LABEL[request.status].toLowerCase()}`}
      style={{ gridColumn: `${segment.column} / span ${segment.span}`, gridRow: segment.lane }}
      className={`mx-px flex min-h-11 min-w-0 flex-col justify-center gap-0.5 overflow-hidden px-0.5 py-1 leading-tight sm:px-2.5 sm:py-[5px] ${
        TYPE_COLOR[typeKey] ?? FALLBACK_COLOR
      } ${STATUS_STYLE[request.status]} ${roundedClass(segment)}`}
    >
      <span className="truncate text-xs font-semibold sm:hidden">
        {request.leaveTypeName.charAt(0)}
      </span>
      <span className="hidden truncate text-xs font-semibold sm:block">
        {firstName(request.userName)} · {request.leaveTypeName}
      </span>
      <span className="truncate text-[11px] font-medium sm:hidden">
        {STATUS_SHORT[request.status]}
      </span>
      <span className="hidden truncate text-[11px] font-medium sm:block">
        {STATUS_LABEL[request.status]}
      </span>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-ink">
      <span
        aria-hidden="true"
        className={`size-2 rounded-[2px] bg-(color:--leave-color) ${color}`}
      />
      {label}
    </span>
  );
}

/**
 * US-10. A month of leave as bars over the dates. Server-rendered: the month and the rejected
 * switch live in the URL, the requests arrive already scoped by role, and every bar is
 * decorative (aria-hidden) because the same information is listed as text for screen readers.
 */
export function LeaveCalendar({
  role,
  viewerId,
  month,
  today,
  requests,
  showRejected,
}: LeaveCalendarProps) {
  const { weeks } = monthGrid(month);
  const key = monthKey(month);
  // The data layer already leaves rejected requests out unless asked; this keeps the switch honest.
  const visible = requests ? requests.filter((r) => showRejected || r.status !== "rejected") : null;
  const owners = visible ? summarizeOwners(visible, viewerId, month) : null;
  const todayText = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const NAV =
    "flex h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-ink hover:bg-brand-50";

  return (
    <section
      aria-labelledby="calendar-title"
      className="space-y-5 rounded-tile bg-white p-4 shadow-tile sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="calendar-title" className="text-lg font-bold text-ink">
            Leave calendar
          </h2>
          <p className="text-xs text-ink-muted">
            {SUBTITLE[role]} · {monthTitle(month)}
          </p>
        </div>
        <p className="text-xs text-ink-muted">Today is {todayText}</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xl font-semibold text-ink" aria-live="polite">
          {monthTitle(month)}
        </p>
        <div className="flex gap-1">
          <Link
            href={href(shiftMonth(month, -1), showRejected)}
            aria-label="Previous month"
            className={NAV}
          >
            <Image src="/icons/chevron-left.svg" alt="" width={20} height={20} unoptimized />
          </Link>
          <Link href={href(null, showRejected)} className={NAV}>
            Today
          </Link>
          <Link
            href={href(shiftMonth(month, 1), showRejected)}
            aria-label="Next month"
            className={NAV}
          >
            <Image src="/icons/chevron-right.svg" alt="" width={20} height={20} unoptimized />
          </Link>
        </div>
      </div>

      {visible === null ? (
        <p role="status" className="rounded-lg bg-page p-4 text-sm text-ink-muted">
          The calendar is not available right now. Try again in a moment.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-line">
            <div
              aria-hidden="true"
              className="grid h-8 grid-cols-7 items-center bg-page text-center text-[11px] font-semibold text-ink-muted"
            >
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            {weeks.map((week) => {
              const { segments } = layoutWeek(visible, week);
              return (
                <div key={week[0]} className="relative min-h-[86px]">
                  <div aria-hidden="true" className="absolute inset-0 grid grid-cols-7">
                    {week.map((date, i) => {
                      const inMonth = date.slice(0, 7) === key;
                      const isToday = date === today;
                      return (
                        <div
                          key={date}
                          className={`border-t border-line px-1 pt-1.5 sm:px-2.5 ${
                            i > 0 ? "border-l" : ""
                          } ${inMonth ? "bg-white" : "bg-calendar-cell"}`}
                        >
                          <span
                            aria-current={isToday ? "date" : undefined}
                            className={`flex h-6 w-[30px] items-center justify-center rounded-[5px] text-xs font-medium ${
                              isToday
                                ? "bg-brand-500 text-white"
                                : inMonth
                                  ? "text-ink"
                                  : "text-ink-muted"
                            }`}
                          >
                            {Number(date.slice(8, 10))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div
                    aria-hidden="true"
                    className="relative grid grid-cols-7 gap-y-1 px-px pb-1.5 pt-8"
                  >
                    {segments.map((segment) => (
                      <Bar key={`${segment.request.id}-${week[0]}`} segment={segment} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
            <div aria-hidden="true" className="space-y-2">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <LegendSwatch color={TYPE_COLOR.vacation!} label="Vacation" />
                <LegendSwatch color={TYPE_COLOR.sick!} label="Sick" />
                <LegendSwatch color={TYPE_COLOR.unpaid!} label="Unpaid" />
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-ink">
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-6 rounded-[2px] bg-(color:--leave-color) ${TYPE_COLOR.vacation}`}
                  />
                  Approved · solid
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`leave-stripes h-2 w-6 rounded-[2px] border border-(color:--leave-color) ${TYPE_COLOR.vacation}`}
                  />
                  Pending · striped
                </span>
                {showRejected ? (
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-6 rounded-[2px] border border-dashed border-(color:--leave-color) bg-grey-100 ${TYPE_COLOR.vacation}`}
                    />
                    Rejected · dashed
                  </span>
                ) : null}
              </div>
            </div>
            <RejectedToggle checked={showRejected} href={href(month, !showRejected)} />
          </div>

          {owners && (owners.you || owners.others) ? (
            <div
              aria-hidden="true"
              className="space-y-1.5 rounded-lg bg-page p-3 text-xs leading-normal sm:hidden"
            >
              {owners.you ? <p className="text-ink">You: {owners.you}</p> : null}
              {owners.others ? (
                <p className="text-ink-muted">
                  {OTHERS_LABEL[role]}: {owners.others}
                </p>
              ) : null}
            </div>
          ) : null}
          <p aria-hidden="true" className="text-xs leading-normal text-ink-muted sm:hidden">
            Appr. = Approved · Pend. = Pending
            {showRejected ? " · Rej. = Rejected" : ""}
          </p>

          <div className="sr-only">
            <h3>Leave in {monthTitle(month)}</h3>
            {visible.length === 0 ? (
              <p>No leave this month.</p>
            ) : (
              <ul>
                {visible.map((r) => (
                  <li key={r.id}>
                    {r.userName}, {r.leaveTypeName}, {STATUS_LABEL[r.status].toLowerCase()},{" "}
                    {r.startDate === r.endDate
                      ? dayLabel(r.startDate)
                      : `${dayLabel(r.startDate)} to ${dayLabel(r.endDate)}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
