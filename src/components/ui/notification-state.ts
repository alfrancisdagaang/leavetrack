import type { NotificationList, NotificationView } from "@/lib/leave/notifications";

/**
 * TASK-055. The bell's state as a pure reducer, so every transition is unit tested (the repo has
 * no DOM test environment). Optimistic marking keeps the badge honest while the POST is in
 * flight; a failure puts the previous state back and raises `markFailed`.
 */
export type BellState = {
  /** `idle` before the first read, `loading` during the first read, `error` after a failed one. */
  status: "idle" | "loading" | "ready" | "error";
  /** Null when unknown (not read yet, or the read failed): the bell shows no count. */
  unread: number | null;
  items: NotificationView[];
  markFailed: boolean;
};

export const initialBellState: BellState = {
  status: "idle",
  unread: null,
  items: [],
  markFailed: false,
};

export type BellAction =
  | { type: "load" }
  | { type: "loaded"; list: NotificationList }
  | { type: "failed" }
  | { type: "mark_one"; id: string; at: string }
  | { type: "mark_all"; at: string }
  | { type: "mark_ok"; unread: number }
  | { type: "mark_failed"; previous: BellState }
  | { type: "dismiss_mark_error" };

export function bellReducer(state: BellState, action: BellAction): BellState {
  switch (action.type) {
    case "load":
      // A refresh keeps what is on screen; only the first read shows the loading rows.
      return state.status === "ready" ? state : { ...state, status: "loading" };
    case "loaded":
      return {
        status: "ready",
        unread: action.list.unread,
        items: action.list.notifications,
        markFailed: false,
      };
    case "failed":
      // AC3: a failed read shows the bell without a count.
      return { status: "error", unread: null, items: [], markFailed: false };
    case "mark_one": {
      const target = state.items.find((n) => n.id === action.id);
      if (!target || target.readAt !== null) return state;
      return {
        ...state,
        unread: state.unread === null ? null : Math.max(0, state.unread - 1),
        items: state.items.map((n) => (n.id === action.id ? { ...n, readAt: action.at } : n)),
      };
    }
    case "mark_all":
      return {
        ...state,
        unread: state.unread === null ? null : 0,
        items: state.items.map((n) => (n.readAt === null ? { ...n, readAt: action.at } : n)),
      };
    case "mark_ok":
      return { ...state, unread: action.unread };
    case "mark_failed":
      return { ...action.previous, markFailed: true };
    case "dismiss_mark_error":
      return { ...state, markFailed: false };
  }
}
