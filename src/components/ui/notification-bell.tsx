"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { UserRole } from "@/lib/db/types";
import type { NotificationView } from "@/lib/leave/notifications";
import { NotificationPanel } from "@/components/ui/notification-panel";
import { bellReducer, initialBellState, type BellState } from "@/components/ui/notification-state";
import {
  badgeText,
  bellLabel,
  parseMarkResult,
  parseNotificationList,
} from "@/components/ui/notification-text";

interface NotificationBellProps {
  role: UserRole;
  timeZone: string;
}

/**
 * The bell in the top bar (TASK-055, EPIC-9). The only client piece of the feature. It reads the
 * session user's notifications through GET /api/notifications and marks them read through
 * POST /api/notifications/read (a route handler, AGENTS.md rule 11).
 *
 * It costs the server NOTHING while a page renders: the layout runs no statement for it, because
 * the dashboards already use the whole page budget (POOL_MAX - 1). The count is fetched once after
 * the page has loaded, when the panel opens and when the tab becomes visible again, never on
 * navigation (that would overlap the next page's own statements) and never by polling. A failed
 * read leaves the bell without a count and an alert with Retry inside the panel; nothing else on
 * the page is affected.
 */
export function NotificationBell({ role, timeZone }: NotificationBellProps) {
  const pathname = usePathname();
  const [state, dispatch] = useReducer(bellReducer, initialBellState);
  // Remember which page the panel was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const [now, setNow] = useState(() => new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const stateRef = useRef<BellState>(state);
  const inFlight = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const load = useCallback(async () => {
    const ticket = ++inFlight.current;
    dispatch({ type: "load" });
    try {
      const res = await fetch("/api/notifications", {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      const list = res.ok ? parseNotificationList(await res.json()) : null;
      if (ticket !== inFlight.current) return; // a newer read superseded this one
      if (list) {
        setNow(new Date());
        dispatch({ type: "loaded", list });
      } else {
        dispatch({ type: "failed" });
      }
    } catch {
      if (ticket === inFlight.current) dispatch({ type: "failed" });
    }
  }, []);

  // One read after the page has loaded, off the critical path of the streamed page content.
  useEffect(() => {
    // Safari has no requestIdleCallback.
    const hasIdle = "requestIdleCallback" in window;
    const id = hasIdle
      ? window.requestIdleCallback(() => void load(), { timeout: 2000 })
      : window.setTimeout(() => void load(), 500);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (hasIdle) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenOn(null);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpenOn(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  /**
   * POST the mark and take the server's remaining count; on any failure put the old state back.
   * A read that was already in flight when the person clicked would answer with the list as it was
   * BEFORE the mark and put the badge back, so a mark first invalidates every older read, and
   * reads once more when it has settled so the list and the count match the server.
   */
  const mark = useCallback(
    async (body: { id?: string }, previous: BellState) => {
      try {
        const res = await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true, // a row click also navigates; let the request finish
        });
        const result = res.ok ? parseMarkResult(await res.json()) : null;
        if (result) dispatch({ type: "mark_ok", unread: result.unread });
        else dispatch({ type: "mark_failed", previous });
      } catch {
        dispatch({ type: "mark_failed", previous });
      }
      void load();
    },
    [load],
  );

  const toggle = () => {
    if (open) {
      setOpenOn(null);
      return;
    }
    setOpenOn(pathname);
    setNow(new Date());
    void load();
  };

  const onMarkAll = () => {
    const previous = stateRef.current;
    inFlight.current += 1; // older reads must not undo this
    dispatch({ type: "mark_all", at: new Date().toISOString() });
    void mark({}, previous);
  };

  const onRowClick = (n: NotificationView) => {
    setOpenOn(null);
    if (n.readAt !== null) return;
    const previous = stateRef.current;
    inFlight.current += 1; // older reads must not undo this
    dispatch({ type: "mark_one", id: n.id, at: new Date().toISOString() });
    void mark({ id: n.id }, previous);
  };

  const badge = badgeText(state.unread);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="notification-panel"
        aria-label={bellLabel(state.unread)}
        onClick={toggle}
        className="relative flex size-11 items-center justify-center rounded-lg border border-line text-ink hover:bg-brand-50"
      >
        <Image src="/icons/bell.svg" alt="" width={20} height={20} unoptimized />
        {badge ? (
          <span
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-bold leading-none text-white"
          >
            {badge}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id="notification-panel"
          className="fixed inset-x-4 top-[76px] z-30 max-h-[min(32rem,calc(100dvh-6rem))] overflow-y-auto rounded-tile border border-line bg-white py-1 shadow-tile sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <NotificationPanel
            state={state}
            role={role}
            now={now}
            timeZone={timeZone}
            onMarkAll={onMarkAll}
            onRowClick={onRowClick}
            onRetry={() => void load()}
          />
        </div>
      ) : null}
    </div>
  );
}
