import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { NotificationView } from "@/lib/leave/notifications";
import type { BellState } from "@/components/ui/notification-state";

vi.mock("next/navigation", () => ({ usePathname: () => "/approvals" }));

const { NotificationBell } = await import("@/components/ui/notification-bell");
const { NotificationPanel } = await import("@/components/ui/notification-panel");

const NOW = new Date("2026-10-20T08:00:00Z");
const note = (over: Partial<NotificationView> = {}): NotificationView => ({
  id: "40000000-0000-4000-8000-000000000001",
  kind: "submitted",
  createdAt: "2026-10-20T07:55:00Z",
  readAt: null,
  requestId: "30000000-0000-4000-8000-000000000001",
  employeeName: "Elena Cruz",
  leaveTypeName: "Vacation",
  startDate: "2026-11-02",
  endDate: "2026-11-03",
  requestRemoved: false,
  ...over,
});
const state = (over: Partial<BellState> = {}): BellState => ({
  status: "ready",
  unread: 0,
  items: [],
  markFailed: false,
  ...over,
});
const noop = () => {};
function panel(s: BellState, role: "employee" | "manager" | "hr_admin" = "manager") {
  return renderToStaticMarkup(
    createElement(NotificationPanel, {
      state: s,
      role,
      now: NOW,
      timeZone: "UTC",
      onMarkAll: noop,
      onRowClick: noop,
      onRetry: noop,
    }),
  );
}

describe("NotificationBell (closed)", () => {
  const html = renderToStaticMarkup(
    createElement(NotificationBell, { role: "manager", timeZone: "UTC" }),
  );

  it("renders only the labelled button: no panel, no badge, before the first read", () => {
    expect(html).toContain('aria-label="Notifications"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="notification-panel"');
    expect(html).not.toContain('id="notification-panel"');
    expect(html).not.toContain("99+");
  });

  it("is a 44 px button (size-11) with a decorative icon", () => {
    expect(html).toMatch(/class="[^"]*\bsize-11\b/);
    expect(html).toContain('alt=""');
  });
});

describe("NotificationPanel rows", () => {
  const rows = panel(
    state({
      unread: 1,
      items: [note(), note({ id: "n2", kind: "approved", readAt: "2026-10-20T07:58:00Z" })],
    }),
    "manager",
  );

  it("marks an unread row by the word New, a hidden 'Unread' and a dot, and a read row by none", () => {
    const [first, second] = rows.split("<li").slice(1);
    expect(first).toContain("New");
    expect(first).toContain("Unread: ");
    expect(second).not.toContain("New");
    expect(second).not.toContain("Unread: ");
  });

  it("builds the sentence and the time from the fields, in bold for the person", () => {
    expect(rows).toContain("<strong");
    expect(rows).toContain("Elena Cruz");
    expect(rows).toContain("requested Vacation leave, Nov 2–3, 2026");
    expect(rows).toContain("5 min ago");
  });

  it("links to a page that exists for the role, without prefetching", () => {
    expect(rows).toContain('href="/approvals"');
    expect(panel(state({ unread: 1, items: [note()] }), "employee")).toContain('href="/balance"');
  });

  it("every row is at least 64 px tall and keeps long names inside the panel", () => {
    const long = panel(
      state({
        unread: 1,
        items: [
          note({ employeeName: "Maximiliano-Bartholomew-Constantinopoulos-Fitzgerald-Reyes" }),
        ],
      }),
    );
    expect(long).toContain("min-h-16");
    expect(long).toContain("break-words");
    expect(long).toContain("min-w-0");
  });

  it("says when the request was removed", () => {
    expect(panel(state({ items: [note({ requestRemoved: true })] }))).toContain(
      "(request removed)",
    );
  });

  it("Mark all as read is a 44 px button, disabled when nothing is unread", () => {
    const none = panel(state({ items: [note({ readAt: "2026-10-20T07:58:00Z" })] }));
    expect(none).toMatch(/<button[^>]*\sdisabled=""[^>]*>Mark all as read/);
    expect(none).toContain("min-h-11");
    expect(rows).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Mark all as read/);
  });

  it("shows the mark-failed alert only after a failed mark", () => {
    expect(panel(state({ items: [note()], unread: 1 }))).not.toContain("Could not update");
    const failed = panel(state({ items: [note()], unread: 1, markFailed: true }));
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Could not update your notifications");
  });
});

describe("NotificationPanel states", () => {
  it("empty: all caught up, with a helper line", () => {
    const html = panel(state());
    expect(html).toContain("You’re all caught up");
    expect(html).toContain("New requests and decisions will show up here.");
  });

  it("error: a role=alert message and a Retry button, and no rows", () => {
    const html = panel(state({ status: "error", unread: null }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Notifications could not be loaded.");
    expect(html).toContain("Retry");
    expect(html).not.toContain("<strong");
  });

  it("loading: skeleton rows announced once as a status, not as rows", () => {
    for (const status of ["idle", "loading"] as const) {
      const html = panel(state({ status, unread: null }));
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("Loading notifications…");
      expect(html).not.toContain("You’re all caught up");
    }
  });
});
