import Image from "next/image";
import Link from "next/link";
import type { UserRole } from "@/lib/db/types";
import type { NotificationView } from "@/lib/leave/notifications";
import type { BellState } from "@/components/ui/notification-state";
import {
  notificationHref,
  notificationIcon,
  notificationSentence,
  relativeTime,
} from "@/components/ui/notification-text";
import { Skeleton } from "@/components/ui/skeleton";

interface PanelProps {
  state: BellState;
  role: UserRole;
  now: Date;
  timeZone: string;
  onMarkAll: () => void;
  onRowClick: (n: NotificationView) => void;
  onRetry: () => void;
}

/**
 * The bell's dropdown content (TASK-055). Presentational: everything arrives in props, so it renders
 * the same in the app and in the unit tests. An unread row is marked by weight, a dot AND the word
 * "New" (never colour alone); long names wrap instead of widening the panel.
 */
export function NotificationPanel({
  state,
  role,
  now,
  timeZone,
  onMarkAll,
  onRowClick,
  onRetry,
}: PanelProps) {
  const unread = state.items.some((n) => n.readAt === null);
  const loading = state.status === "idle" || state.status === "loading";

  return (
    <div>
      <div className="flex min-h-12 items-center justify-between gap-3 px-4">
        <h2 className="text-[15px] font-bold text-ink">Notifications</h2>
        <button
          type="button"
          onClick={onMarkAll}
          disabled={!unread}
          className="min-h-11 rounded-lg px-1 text-[13px] font-semibold text-brand-500 hover:underline disabled:cursor-not-allowed disabled:text-ink-muted disabled:no-underline"
        >
          Mark all as read
        </button>
      </div>

      {state.markFailed ? (
        <p role="alert" className="mx-4 mb-2 rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn-fg">
          Could not update your notifications. Try again.
        </p>
      ) : null}

      {loading ? (
        <ul role="status" aria-busy="true" className="px-4 pb-3">
          <li className="sr-only">Loading notifications…</li>
          {[0, 1, 2].map((i) => (
            <li key={i} aria-hidden="true" className="flex items-center gap-3 py-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      ) : state.status === "error" ? (
        <div className="space-y-3 px-4 pb-4">
          <p
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-warn-bg px-3 py-2.5 text-[13px] text-warn-fg"
          >
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-warn-dot" />
            Notifications could not be loaded.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 w-full rounded-lg border border-brand-500 text-[13px] font-semibold text-brand-500 hover:bg-brand-50"
          >
            Retry
          </button>
        </div>
      ) : state.items.length === 0 ? (
        <div className="flex flex-col items-center px-6 pb-8 pt-6 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-50">
            <Image src="/icons/bell.svg" alt="" width={24} height={24} unoptimized />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-ink">You’re all caught up</p>
          <p className="mt-1 text-xs text-ink-muted">
            New requests and decisions will show up here.
          </p>
        </div>
      ) : (
        <ul className="pb-1">
          {state.items.map((n) => {
            const sentence = notificationSentence(n, role);
            const icon = notificationIcon(n);
            const isUnread = n.readAt === null;
            return (
              <li key={n.id} className="border-t border-line first:border-t-0">
                <Link
                  href={notificationHref(role)}
                  prefetch={false}
                  onClick={() => onRowClick(n)}
                  className={`flex min-h-16 items-start gap-3 px-4 py-3 text-ink hover:bg-brand-50 ${
                    isUnread ? "bg-brand-50" : ""
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full ${icon.tint}`}
                  >
                    <Image src={icon.icon} alt="" width={18} height={18} unoptimized />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[13px] leading-snug">
                      {isUnread ? <span className="sr-only">Unread: </span> : null}
                      {sentence.who ? (
                        <>
                          <strong className="font-semibold">{sentence.who}</strong>{" "}
                        </>
                      ) : null}
                      {sentence.text}
                    </span>
                    {sentence.removed ? (
                      <span className="mt-0.5 block text-xs text-ink-muted">(request removed)</span>
                    ) : null}
                    <span className="mt-1 block text-xs text-ink-muted">
                      {relativeTime(n.createdAt, now, timeZone)}
                    </span>
                  </span>
                  {isUnread ? (
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex shrink-0 items-center gap-1.5 text-xs font-semibold text-brand-500"
                    >
                      <span className="size-2 rounded-full bg-brand-500" />
                      New
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
