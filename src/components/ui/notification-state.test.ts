import { describe, expect, it } from "vitest";
import type { NotificationView } from "@/lib/leave/notifications";
import { bellReducer, initialBellState, type BellState } from "@/components/ui/notification-state";

const item = (id: string, readAt: string | null = null): NotificationView => ({
  id,
  kind: "submitted",
  createdAt: "2026-10-20T08:00:00Z",
  readAt,
  requestId: "r",
  employeeName: "Elena Cruz",
  leaveTypeName: "Vacation",
  startDate: "2026-11-02",
  endDate: "2026-11-03",
  requestRemoved: false,
});
const AT = "2026-10-20T09:00:00Z";
const ready = (unread: number, items: NotificationView[]): BellState => ({
  status: "ready",
  unread,
  items,
  markFailed: false,
});

describe("bellReducer (TASK-055)", () => {
  it("starts with no count and nothing loaded", () => {
    expect(initialBellState).toEqual({
      status: "idle",
      unread: null,
      items: [],
      markFailed: false,
    });
  });

  it("the first read shows loading; a refresh keeps what is on screen", () => {
    expect(bellReducer(initialBellState, { type: "load" }).status).toBe("loading");
    const shown = ready(2, [item("a"), item("b")]);
    expect(bellReducer(shown, { type: "load" })).toBe(shown);
  });

  it("loaded fills the list and the count", () => {
    const next = bellReducer(initialBellState, {
      type: "loaded",
      list: { unread: 5, notifications: [item("a")] },
    });
    expect(next).toEqual({ status: "ready", unread: 5, items: [item("a")], markFailed: false });
  });

  it("AC3: a failed read leaves no count (even after a good one) and clears the list", () => {
    const next = bellReducer(ready(3, [item("a")]), { type: "failed" });
    expect(next).toEqual({ status: "error", unread: null, items: [], markFailed: false });
  });

  it("mark_one reads one unread row and lowers the count by one", () => {
    const next = bellReducer(ready(2, [item("a"), item("b")]), {
      type: "mark_one",
      id: "a",
      at: AT,
    });
    expect(next.unread).toBe(1);
    expect(next.items.map((n) => n.readAt)).toEqual([AT, null]);
  });

  it("mark_one on an already-read row, or an unknown row, changes nothing", () => {
    const state = ready(1, [item("a", AT), item("b")]);
    expect(bellReducer(state, { type: "mark_one", id: "a", at: "x" })).toBe(state);
    expect(bellReducer(state, { type: "mark_one", id: "zzz", at: "x" })).toBe(state);
  });

  it("the count never goes below zero", () => {
    const next = bellReducer(ready(0, [item("a")]), { type: "mark_one", id: "a", at: AT });
    expect(next.unread).toBe(0);
  });

  it("mark_all reads every unread row, keeps the read times of the rest, and zeroes the count", () => {
    const next = bellReducer(ready(2, [item("a", "old"), item("b"), item("c")]), {
      type: "mark_all",
      at: AT,
    });
    expect(next.unread).toBe(0);
    expect(next.items.map((n) => n.readAt)).toEqual(["old", AT, AT]);
  });

  it("mark_all keeps counts beyond the visible rows honest: the server's count replaces it", () => {
    // 25 unread, only 20 listed: after mark-all the local count is 0 and mark_ok confirms it.
    const marked = bellReducer(ready(25, [item("a")]), { type: "mark_all", at: AT });
    expect(marked.unread).toBe(0);
    expect(bellReducer(marked, { type: "mark_ok", unread: 0 }).unread).toBe(0);
    expect(bellReducer(marked, { type: "mark_ok", unread: 4 }).unread).toBe(4);
  });

  it("mark_failed puts the previous state back and raises the flag; dismiss clears it", () => {
    const before = ready(2, [item("a"), item("b")]);
    const optimistic = bellReducer(before, { type: "mark_all", at: AT });
    const failed = bellReducer(optimistic, { type: "mark_failed", previous: before });
    expect(failed).toEqual({ ...before, markFailed: true });
    expect(bellReducer(failed, { type: "dismiss_mark_error" }).markFailed).toBe(false);
  });

  it("marking while the count is unknown keeps it unknown", () => {
    const state: BellState = { ...ready(0, [item("a")]), unread: null };
    expect(bellReducer(state, { type: "mark_one", id: "a", at: AT }).unread).toBeNull();
    expect(bellReducer(state, { type: "mark_all", at: AT }).unread).toBeNull();
  });
});
