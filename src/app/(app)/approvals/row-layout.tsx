import type { ReactNode } from "react";
import { formatRange } from "@/app/(app)/audit/audit-format";
import { CalendarIcon, NoteIcon, PersonIcon } from "./overrides/override-icons";

/** A request row inside a section card (Team Approvals and Balance Overrides share it). */
export const ROW = "rounded-xl border border-line bg-white p-4 sm:p-5";

/** Dividers before every column but the first, from `lg`; below it the columns stack. */
const DIVIDED =
  "lg:items-start lg:gap-0 [&>*]:lg:px-5 [&>*:first-child]:lg:pl-0 [&>*:last-child]:lg:pr-0 [&>*:not(:first-child)]:lg:border-l [&>*:not(:first-child)]:lg:border-line";

/** Four columns: the person, the dates, the status, the actions. */
export const GRID4 = `grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.15fr)_minmax(0,1.3fr)_auto] ${DIVIDED}`;
/** Three columns: the same, without the actions (a decided row). */
export const GRID3 = `grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.15fr)_minmax(0,1.3fr)] ${DIVIDED}`;

/** The dates with a calendar icon, the working days with a person icon, and the manager if given. */
export function DatesColumn({
  start,
  end,
  days,
  manager,
}: {
  start: string;
  end: string;
  days: string;
  manager?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-2 font-semibold text-ink">
        <span className="text-ink-muted">
          <CalendarIcon />
        </span>
        {formatRange(start, end)}
      </p>
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <PersonIcon />
        {days}
      </p>
      {manager !== undefined ? (
        <p className="break-words pl-6 text-sm text-ink-muted">
          Manager: {manager ?? "No manager"}
        </p>
      ) : null}
    </div>
  );
}

/** A light strip under a row that says what approving or deciding does. Written text, never colour alone. */
export function NoteStrip({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-lg bg-brand-50/60 px-3 py-2.5 text-sm text-ink-muted">
      <span className="mt-0.5 shrink-0">
        <NoteIcon />
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
