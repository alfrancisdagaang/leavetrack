import { formatDateRange, tileParts } from "@/lib/leave/format";
import type { IsoDate } from "@/lib/leave/calendar-layout";
import type { UpcomingLeave } from "@/lib/leave/upcoming";

const STATUS_TEXT: Record<UpcomingLeave["status"], string> = {
  pending: "Pending",
  approved: "Approved",
};

/**
 * The dashboard's "Upcoming leave" card (US-11, Figma 14:9341). Presentational: the scoped rows
 * arrive in `items` (null when the read failed). Rows have no link and there is no "View all" yet,
 * because no request details page exists. Status is written as text, never colour alone.
 */
export function UpcomingLeaveCard({
  items,
  viewerId,
  today,
}: {
  items: readonly UpcomingLeave[] | null;
  viewerId: string;
  today: IsoDate;
}) {
  return (
    <section
      aria-labelledby="upcoming-leave-heading"
      className="rounded-tile bg-white p-5 shadow-tile sm:p-6"
    >
      <h2
        id="upcoming-leave-heading"
        className="flex min-h-11 items-center text-[17px] font-bold text-ink"
      >
        Upcoming leave
      </h2>
      {items === null ? (
        <p role="alert" className="py-3 text-sm text-ink-muted">
          Upcoming leave is not available right now. Try again in a moment.
        </p>
      ) : items.length === 0 ? (
        <p className="py-3 text-sm text-ink-muted">No upcoming leave.</p>
      ) : (
        <ul>
          {items.map((item) => {
            const tile = tileParts(item.startDate, today);
            return (
              <li
                key={item.id}
                className="flex min-h-[78px] items-center gap-3 border-t border-line first:border-t-0"
              >
                <div
                  aria-hidden="true"
                  className="flex size-[50px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-page"
                >
                  <span className="text-[10px] font-semibold leading-none text-ink-muted">
                    {tile.month}
                  </span>
                  <span className="text-lg font-bold leading-none text-ink">{tile.day}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="break-words text-[13px] font-semibold text-ink">
                    {item.userName}
                    {item.userId === viewerId ? " · You" : ""}
                  </p>
                  <p className="break-words text-xs text-ink-muted">
                    {formatDateRange(item.startDate, item.endDate)} · {item.leaveTypeName}
                  </p>
                  <p className="text-xs font-medium text-ink-muted">{STATUS_TEXT[item.status]}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
