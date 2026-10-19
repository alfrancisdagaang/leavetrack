import { ORG_PAGE_SIZE, type OrgNode } from "@/lib/leave/org";

/**
 * TASK-064 (EPIC-11). The HR tree's state as a pure reducer, so every transition is unit tested (the
 * repo has no DOM test environment). One record per opened person: what was loaded, which page is
 * next, and whether a read is in flight. A `ticket` per request makes a late answer for an older request
 * harmless, the way the notification bell does.
 */
export type OrgHrNode = {
  open: boolean;
  /** `idle` before the first read, `error` after a failed one (what was loaded stays). */
  status: "idle" | "loading" | "ready" | "error";
  people: OrgNode[];
  /** The last page loaded (0 before any), as the server clamped it. */
  page: number;
  total: number;
  /** The ticket of the newest request for this person; answers with another ticket are ignored. */
  ticket: number;
};

export type OrgHrState = {
  nodes: Record<string, OrgHrNode>;
  /** After "Show more", the person to focus (the first new one), so focus is not lost with the button. */
  focusId: string | null;
};

export const initialOrgHrState: OrgHrState = { nodes: {}, focusId: null };

const IDLE: OrgHrNode = { open: false, status: "idle", people: [], page: 0, total: 0, ticket: 0 };

export type OrgHrAction =
  | { type: "open"; id: string }
  | { type: "collapse"; id: string }
  | { type: "request"; id: string; ticket: number }
  | { type: "loaded"; id: string; ticket: number; page: number; total: number; people: OrgNode[] }
  | { type: "failed"; id: string; ticket: number }
  | { type: "focus_done" };

export const nodeOf = (state: OrgHrState, id: string): OrgHrNode => state.nodes[id] ?? IDLE;

/** The page the next read asks for: the first, or the one after the last loaded (the same one again after an error). */
export const nextPage = (node: OrgHrNode): number => node.page + 1;

/** More people exist than the pages loaded so far. */
export const hasMore = (node: OrgHrNode): boolean => node.page * ORG_PAGE_SIZE < node.total;

export function orgHrReducer(state: OrgHrState, action: OrgHrAction): OrgHrState {
  if (action.type === "focus_done") return { ...state, focusId: null };
  const node = nodeOf(state, action.id);
  const put = (next: OrgHrNode, focusId = state.focusId): OrgHrState => ({
    nodes: { ...state.nodes, [action.id]: next },
    focusId,
  });

  switch (action.type) {
    case "open":
      return put({ ...node, open: true });
    case "collapse":
      // What was loaded stays, so opening again is instant and "Show more" resumes where it was.
      return put({ ...node, open: false });
    case "request":
      return put({ ...node, open: true, status: "loading", ticket: action.ticket });
    case "loaded": {
      if (action.ticket !== node.ticket) return state; // a newer request superseded this answer
      const seen = new Set(node.people.map((p) => p.id));
      // Pages are offsets: if someone joined in between, a person can repeat. Show each once.
      const added = action.people.filter((p) => !seen.has(p.id));
      return put(
        {
          ...node,
          status: "ready",
          people: [...node.people, ...added],
          page: action.page,
          total: action.total,
        },
        node.people.length > 0 && added[0] ? added[0].id : state.focusId,
      );
    }
    case "failed":
      if (action.ticket !== node.ticket) return state;
      return put({ ...node, status: "error" });
  }
}
