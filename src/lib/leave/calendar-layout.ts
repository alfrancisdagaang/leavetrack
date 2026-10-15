/**
 * Pure helpers for the dashboard leave calendar (US-10): which weeks a month needs, which day
 * "today" is, and how requests become bars in a week row. No I/O. Dates are ISO `YYYY-MM-DD`
 * strings (leave has no time or zone), so comparing them as strings is the same as comparing days.
 */

export type IsoDate = string;
export type MonthRef = { year: number; month: number }; // month is 1-12

export type CalendarStatus = "pending" | "approved" | "rejected";

export type CalendarRequest = {
  id: string;
  userId: string;
  userName: string;
  leaveTypeName: string;
  startDate: IsoDate;
  endDate: IsoDate;
  status: CalendarStatus;
};

/** One request's slice inside one week row. Columns are 1-7, Sunday first. */
export type BarSegment = {
  request: CalendarRequest;
  column: number;
  span: number;
  /** 1-based row inside the week, so overlapping bars sit on different rows. */
  lane: number;
  startsHere: boolean;
  endsHere: boolean;
};

const MONTH_PARAM = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_SHORT = MONTH_NAMES.map((name) => name.slice(0, 3));

const pad = (n: number) => String(n).padStart(2, "0");
const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));
const toIso = (date: Date): IsoDate => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

export const monthOf = (iso: IsoDate): MonthRef => ({
  year: Number(iso.slice(0, 4)),
  month: Number(iso.slice(5, 7)),
});

export const monthKey = ({ year, month }: MonthRef): string => `${year}-${pad(month)}`;

export const monthTitle = ({ year, month }: MonthRef): string =>
  `${MONTH_NAMES[month - 1]} ${year}`;

/** `?month=YYYY-MM`. Anything else (missing, malformed, out of range) falls back to today's month. */
export function parseMonthParam(value: string | undefined, today: IsoDate): MonthRef {
  const match = value ? MONTH_PARAM.exec(value) : null;
  if (match) {
    const year = Number(match[1]);
    if (year >= 2000 && year <= 2100) return { year, month: Number(match[2]) };
  }
  return monthOf(today);
}

export function shiftMonth({ year, month }: MonthRef, delta: number): MonthRef {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The ISO date of "now" in an IANA time zone (so the highlighted day matches the user's day). */
export function todayIn(timeZone: string, now: Date): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Sunday-first weeks that cover the month, plus the first and last date shown. */
export function monthGrid(ref: MonthRef): { weeks: IsoDate[][]; from: IsoDate; to: IsoDate } {
  const first = utc(ref.year, ref.month, 1);
  const last = utc(ref.year, ref.month + 1, 0);
  const start = addDays(first, -first.getUTCDay());
  const end = addDays(last, 6 - last.getUTCDay());
  const weeks: IsoDate[][] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => toIso(addDays(cursor, i))));
  }
  return { weeks, from: toIso(start), to: toIso(end) };
}

/**
 * Places the requests that touch `week` as bars. A request that runs past the week's edge is
 * clipped (and continues in the next week). Bars are laid on the first free row, so two bars
 * never overlap. Stable: longer and earlier requests go first, then by id.
 */
export function layoutWeek(
  requests: readonly CalendarRequest[],
  week: readonly IsoDate[],
): { segments: BarSegment[]; lanes: number } {
  const weekStart = week[0]!;
  const weekEnd = week[6]!;
  const touching = requests
    .filter((r) => r.startDate <= weekEnd && r.endDate >= weekStart)
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        b.endDate.localeCompare(a.endDate) ||
        a.id.localeCompare(b.id),
    );

  const laneEnds: number[] = []; // last occupied column index per lane
  const segments: BarSegment[] = [];
  for (const request of touching) {
    const from = request.startDate > weekStart ? request.startDate : weekStart;
    const to = request.endDate < weekEnd ? request.endDate : weekEnd;
    const startIndex = week.indexOf(from);
    const endIndex = week.indexOf(to);
    let lane = laneEnds.findIndex((end) => end < startIndex);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(endIndex);
    } else {
      laneEnds[lane] = endIndex;
    }
    segments.push({
      request,
      column: startIndex + 1,
      span: endIndex - startIndex + 1,
      lane: lane + 1,
      startsHere: request.startDate >= weekStart,
      endsHere: request.endDate <= weekEnd,
    });
  }
  return { segments, lanes: laneEnds.length };
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** "1–3", "8", or "Oct 30–Nov 2" when a request leaves the month being shown. */
function rangeText(request: CalendarRequest, month: MonthRef): string {
  const key = monthKey(month);
  const day = (iso: IsoDate) => String(Number(iso.slice(8, 10)));
  const full = (iso: IsoDate) => `${MONTH_SHORT[Number(iso.slice(5, 7)) - 1]} ${day(iso)}`;
  const { startDate, endDate } = request;
  if (startDate === endDate) return day(startDate);
  if (startDate.slice(0, 7) === key && endDate.slice(0, 7) === key) {
    return `${day(startDate)}–${day(endDate)}`;
  }
  return `${full(startDate)}–${full(endDate)}`;
}

const joinAnd = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/**
 * The text twin of the calendar: "Oct 1–3, 8 and 26–28" for the viewer and
 * "Priya 19–21 · Leo 23" for everyone else, ordered by date. Rejected requests are listed too
 * when they are in `requests` (the caller decides by the toggle).
 */
export function summarizeOwners(
  requests: readonly CalendarRequest[],
  viewerId: string,
  month: MonthRef,
): { you: string | null; others: string | null } {
  const ordered = [...requests].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id),
  );
  const mine = ordered.filter((r) => r.userId === viewerId).map((r) => rangeText(r, month));
  const byPerson = new Map<string, string[]>();
  for (const request of ordered) {
    if (request.userId === viewerId) continue;
    const list = byPerson.get(request.userName) ?? [];
    list.push(rangeText(request, month));
    byPerson.set(request.userName, list);
  }
  const others = [...byPerson].map(([name, ranges]) => `${firstName(name)} ${ranges.join(", ")}`);
  return {
    you: mine.length ? `${MONTH_SHORT[month.month - 1]} ${joinAnd(mine)}` : null,
    others: others.length ? others.join(" · ") : null,
  };
}

export { firstName };
