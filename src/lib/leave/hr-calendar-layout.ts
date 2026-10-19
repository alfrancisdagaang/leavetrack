import type { HrDayCount } from "@/lib/leave/hr-calendar";
import type { IsoDate, MonthRef } from "@/lib/leave/calendar-layout";

/**
 * EPIC-7. Pure helpers for the HR calendar page: the Monday-to-Friday weeks of a month and the
 * words written for a day's counts. No I/O. Weekends are never shown or counted.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

/** The first and last day of the month, as ISO dates. */
export function monthBounds({ year, month }: MonthRef): { from: IsoDate; to: IsoDate } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}

/**
 * The weeks of the month as rows of five weekdays (Monday to Friday). A slot outside the month is
 * `null`. A week with no weekday in the month is not returned.
 */
export function weekdayWeeks(ref: MonthRef): (IsoDate | null)[][] {
  const last = new Date(Date.UTC(ref.year, ref.month, 0)).getUTCDate();
  const weeks: (IsoDate | null)[][] = [];
  let row: (IsoDate | null)[] = [null, null, null, null, null];
  let any = false;
  for (let day = 1; day <= last; day += 1) {
    const weekday = new Date(Date.UTC(ref.year, ref.month - 1, day)).getUTCDay(); // 0 = Sunday
    if (weekday === 0 || weekday === 6) {
      if (weekday === 6 && any) {
        weeks.push(row);
        row = [null, null, null, null, null];
        any = false;
      }
      continue;
    }
    row[weekday - 1] = `${ref.year}-${pad(ref.month)}-${pad(day)}`;
    any = true;
  }
  if (any) weeks.push(row);
  return weeks;
}

/** "Tue 4 Nov 2026" from `2026-11-04`. */
export function longDay(iso: IsoDate): string {
  const weekday = WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? "";
  return `${weekday} ${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""} ${iso.slice(0, 4)}`;
}

/** "Mon" to "Fri" for a weekday. */
export function weekdayName(iso: IsoDate): string {
  return WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? "";
}

/** "12 out" or "No one out". */
export function outText(count: HrDayCount | undefined): string {
  return count && count.total > 0 ? `${count.total} out` : "No one out";
}

const TYPE_ORDER = ["vacation", "sick", "unpaid"];

/** The leave types in the order the design shows them (Vacation, Sick, Unpaid), any other after, by name. */
export function orderTypeNames(names: readonly string[]): string[] {
  const rank = (name: string) => {
    const i = TYPE_ORDER.indexOf(name.trim().toLowerCase());
    return i === -1 ? TYPE_ORDER.length : i;
  };
  return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** People of one leave type out that day (approved and pending together); zero when nobody is. */
export function typeCounts(
  count: HrDayCount | undefined,
  typeNames: readonly string[],
): { name: string; people: number }[] {
  return typeNames.map((name) => {
    const found = count?.byType.find((t) => t.leaveTypeName === name);
    return { name, people: found ? found.approved + found.pending : 0 };
  });
}

/**
 * "Vacation 8 · Sick 3 · Unpaid 0": people per leave type. With the leave types given, every type is
 * listed (zero included, in the order given); without them, only the types somebody is out on.
 */
export function typeText(count: HrDayCount | undefined, typeNames?: readonly string[]): string {
  if (!count) return "";
  const names = typeNames ?? count.byType.map((t) => t.leaveTypeName);
  return typeCounts(count, names)
    .map((t) => `${t.name} ${t.people}`)
    .join(" · ");
}

/** "2 pending", "0 pending" on a day somebody is out, and nothing on a day nobody is. */
export function pendingText(count: HrDayCount | undefined): string {
  return count && count.total > 0 ? `${count.pending} pending` : "";
}

/** "1 person out" or "12 people out". */
export function peopleOut(total: number): string {
  return `${total} ${total === 1 ? "person" : "people"} out`;
}
