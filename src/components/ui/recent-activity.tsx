import Image from "next/image";
import type { ActivityAction, ActivityEvent } from "@/lib/leave/activity";
import { describeActivity, formatActivityTime } from "@/lib/leave/format";

const EVENT: Record<ActivityAction, { label: string; icon: string; color: string }> = {
  submitted: { label: "Submitted", icon: "/icons/send.svg", color: "text-brand-500" },
  approved: { label: "Approved", icon: "/icons/check.svg", color: "text-event-approved" },
  rejected: { label: "Rejected", icon: "/icons/x.svg", color: "text-event-rejected" },
  soft_deleted: { label: "Cancelled", icon: "/icons/x.svg", color: "text-ink-muted" },
};

/**
 * The dashboard's "Recent activity" card (US-11, Figma 14:9376). Presentational: the scoped events
 * arrive in `events` (null when the read failed). Each event is labelled in text as well as by
 * its icon and colour, and the time is shown in `timeZone`.
 */
export function RecentActivityCard({
  events,
  now,
  timeZone,
}: {
  events: readonly ActivityEvent[] | null;
  now: Date;
  timeZone: string;
}) {
  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="rounded-tile bg-white p-5 shadow-tile sm:p-6"
    >
      <h2
        id="recent-activity-heading"
        className="flex min-h-11 items-center text-[17px] font-bold text-ink"
      >
        Recent activity
      </h2>
      {events === null ? (
        <p role="alert" className="py-3 text-sm text-ink-muted">
          Recent activity is not available right now. Try again in a moment.
        </p>
      ) : events.length === 0 ? (
        <p className="py-3 text-sm text-ink-muted">No recent activity.</p>
      ) : (
        <ul>
          {events.map((event) => {
            const view = EVENT[event.action];
            return (
              <li
                key={event.id}
                className="flex min-h-[78px] items-start gap-3 border-t border-line py-3 first:border-t-0"
              >
                <div
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-page"
                >
                  <Image src={view.icon} alt="" width={16} height={16} unoptimized />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className={`text-xs font-semibold ${view.color}`}>{view.label}</p>
                  <p className="break-words text-xs leading-[1.45] text-ink">
                    {describeActivity(event)}
                  </p>
                  <time dateTime={event.occurredAt} className="text-[11px] text-ink-muted">
                    {formatActivityTime(event.occurredAt, now, timeZone)}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
