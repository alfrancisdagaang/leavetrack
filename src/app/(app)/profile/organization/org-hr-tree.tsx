"use client";

import Image from "next/image";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { ORG_PAGE_SIZE, type OrgNode } from "@/lib/leave/org";
import { parseOrgPage } from "./org-hr-parse";
import {
  hasMore,
  initialOrgHrState,
  nextPage,
  nodeOf,
  orgHrReducer,
  type OrgHrState,
} from "./org-hr-state";
import { PersonCard } from "./org-person";
import { nestClass } from "./org-tree-build";
import { showMoreLabel, toggleLabel } from "./org-text";

const BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-brand-50 aria-busy:opacity-60";

/**
 * HR's view of the company (TASK-064, the only client piece of the Organization tab). The roots come from
 * the server; opening a person reads their reports, 50 at a time, from GET /api/org/children. Each
 * person has its own busy and error state, the toggle keeps focus while it loads, and after "Show more"
 * focus moves to the first new person. A slow answer for an older request is ignored.
 */
export function OrgHrTree({ roots, viewerId }: { roots: OrgNode[]; viewerId: string }) {
  const [state, dispatch] = useReducer(orgHrReducer, initialOrgHrState);
  const stateRef = useRef<OrgHrState>(state);
  const tickets = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!state.focusId) return;
    document.getElementById(`org-person-${state.focusId}`)?.focus();
    dispatch({ type: "focus_done" });
  }, [state.focusId]);

  const load = useCallback(async (id: string) => {
    const node = nodeOf(stateRef.current, id);
    if (node.status === "loading") return; // a read is already running for this person
    const ticket = ++tickets.current;
    const page = nextPage(node);
    dispatch({ type: "request", id, ticket });
    try {
      const res = await fetch(`/api/org/children?parent=${encodeURIComponent(id)}&page=${page}`, {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      const result = res.ok ? parseOrgPage(await res.json()) : null;
      if (result) {
        dispatch({
          type: "loaded",
          id,
          ticket,
          page: result.page,
          total: result.total,
          people: result.people,
        });
      } else {
        dispatch({ type: "failed", id, ticket });
      }
    } catch {
      dispatch({ type: "failed", id, ticket });
    }
  }, []);

  const toggle = (id: string) => {
    const node = nodeOf(stateRef.current, id);
    if (node.open) {
      dispatch({ type: "collapse", id });
      return;
    }
    dispatch({ type: "open", id });
    if (node.status === "idle" || node.status === "error") void load(id);
  };

  // Plain render functions, not components: a component defined inside a component is a new type on
  // every render, so React would remount the whole subtree and the focused button would lose focus.
  const renderList = (nodes: OrgNode[], level: number) => (
    <ul className={`space-y-2 ${level > 1 ? nestClass(level) : ""}`}>
      {nodes.map((n) => renderRow(n, level))}
    </ul>
  );

  const renderRow = (node: OrgNode, level: number) => {
    const s = nodeOf(state, node.id);
    const panelId = `org-panel-${node.id}`;
    const busy = s.status === "loading";
    return (
      <li key={node.id}>
        <div className="flex items-stretch gap-2">
          <div
            id={`org-person-${node.id}`}
            tabIndex={-1}
            className="min-w-0 flex-1 rounded-lg outline-offset-2"
          >
            <PersonCard node={node} you={node.id === viewerId} />
          </div>
          {node.reports > 0 ? (
            <button
              type="button"
              aria-expanded={s.open}
              aria-controls={panelId}
              aria-busy={busy}
              onClick={() => toggle(node.id)}
              className={`${BUTTON} min-w-11 shrink-0`}
            >
              <Image
                src="/icons/chevron-down.svg"
                alt=""
                width={16}
                height={16}
                unoptimized
                className={s.open ? "rotate-180" : undefined}
              />
              <span className="sr-only">{toggleLabel(node.name, node.reports, s.open)}</span>
            </button>
          ) : null}
        </div>
        {s.open ? (
          <div id={panelId} className="mt-2">
            {s.people.length > 0 ? renderList(s.people, level + 1) : null}
            {busy ? (
              <p role="status" className="mt-2 text-sm text-ink-muted">
                Loading…
              </p>
            ) : null}
            {s.status === "error" ? (
              <div
                role="alert"
                className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-rejected-fg/30 bg-rejected-bg px-3 py-2 text-sm text-rejected-fg"
              >
                <span>These people could not be loaded.</span>
                <button type="button" onClick={() => void load(node.id)} className={BUTTON}>
                  Retry
                </button>
              </div>
            ) : null}
            {s.status === "ready" && hasMore(s) ? (
              <button type="button" onClick={() => void load(node.id)} className={`${BUTTON} mt-2`}>
                {showMoreLabel(s.total - s.page * ORG_PAGE_SIZE, ORG_PAGE_SIZE)}
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  };

  return renderList(roots, 1);
}
