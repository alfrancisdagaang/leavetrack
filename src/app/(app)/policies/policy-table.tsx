"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { initialsOf } from "@/components/ui/initials";
import { useFilterNav } from "@/components/ui/filter-shell";
import type { PolicyLastChange, PolicyPerson } from "@/lib/leave/policies";
import type { PolicyListQuery, PolicySort } from "@/lib/leave/policies-schema";
import { sortHref } from "./policies-url";
import { formatLastChange, policyStatus } from "./policy-format";
import { isUnchanged, rateProblem } from "./policy-rate-check";
import { PolicyRateCell, type CellState } from "./policy-rate-cell";
import { PolicyStatusBadge } from "./policy-status-badge";

const cellKey = (userId: string, typeId: string) => `${userId}:${typeId}`;

const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";

/** The message from the standard error envelope, or null when the answer is not one. */
function envelopeMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const error = (body as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : null;
}

type SortColumn = { sort: PolicySort | null; label: string; unit?: string; typeId?: string };

const HEAD =
  "sticky top-0 z-10 border-b border-line bg-white px-3 py-3 text-sm font-medium text-ink-muted";

/**
 * The employees and their rates (EPIC-13). From `xl` a real table (sticky header, sortable columns,
 * the employee as the row header); below it, stacked cards: two native structures with the same rows,
 * one hidden by CSS at each size, as in the audit list. The two share ONE state, so an edit made in
 * either shows in both, and a hidden copy of a field is never focusable.
 *
 * The rows come from the server once per address (the table is re-created when the address changes) and
 * are then kept here: a save updates its row in place, so the order never jumps under the cursor even
 * when the list is sorted by that rate; the tiles and the recent changes are refreshed from the server.
 */
export function PolicyTable({
  people,
  query,
  timeZone,
}: {
  people: PolicyPerson[];
  query: PolicyListQuery;
  timeZone: string;
}) {
  const router = useRouter();
  const { navigate } = useFilterNav();
  // The rows are taken once. The server sends fresh ones after every save (to refresh the tiles and the
  // recent changes), but a row must stay where it is, and stay visible in a filtered or sorted list, until
  // the next navigation; so the rendered rows come from this state, never from the later props.
  const [rows] = useState(people);
  const types = rows[0]?.rates.map((r) => ({ id: r.leaveTypeId, name: r.leaveTypeName })) ?? [];

  const [cells, setCells] = useState<Record<string, CellState>>(() => {
    const initial: Record<string, CellState> = {};
    for (const p of rows)
      for (const r of p.rates)
        initial[cellKey(p.id, r.leaveTypeId)] = {
          saved: r.rate,
          draft: r.rate ?? "",
          status: "idle",
          message: "",
        };
    return initial;
  });
  const [lastChanges, setLastChanges] = useState<Record<string, PolicyLastChange | null>>(() =>
    Object.fromEntries(rows.map((p) => [p.id, p.lastChange])),
  );
  // The newest cells for the handlers below (kept in an effect: a ref is not written during render).
  const latest = useRef(cells);
  useEffect(() => {
    latest.current = cells;
  });
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const patch = (key: string, over: Partial<CellState>) =>
    setCells((c) => ({ ...c, [key]: { ...c[key]!, ...over } }));

  async function save(userId: string, typeId: string) {
    const key = cellKey(userId, typeId);
    const cell = latest.current[key];
    if (!cell || cell.status === "busy") return;
    const typed = cell.draft.trim();
    if (isUnchanged(typed, cell.saved)) return;
    const problem = rateProblem(typed);
    if (problem) {
      patch(key, { status: "error", message: problem });
      return;
    }

    patch(key, { status: "busy", message: "" });
    try {
      const response = await fetch("/api/leave-policies", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          leave_type_id: typeId,
          accrual_per_month: Number(typed),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        patch(key, {
          status: "error",
          message: envelopeMessage(body) ?? "The rate could not be saved. Try again.",
        });
        return;
      }
      const data = (
        body as {
          data?: {
            status?: string;
            newRate?: string;
            changedAt?: string | null;
            changedByName?: string | null;
          };
        } | null
      )?.data;
      const newRate = data?.newRate ?? Number(typed).toFixed(2);
      patch(key, {
        saved: newRate,
        draft: newRate,
        status: "done",
        message: data?.status === "unchanged" ? "No change" : "Saved",
      });
      if (data?.status !== "unchanged" && data?.changedAt && data.changedByName)
        setLastChanges((l) => ({
          ...l,
          [userId]: { at: data.changedAt!, by: data.changedByName! },
        }));
      timers.current.push(
        window.setTimeout(
          () =>
            setCells((c) =>
              c[key]?.status === "done"
                ? { ...c, [key]: { ...c[key]!, status: "idle", message: "" } }
                : c,
            ),
          2500,
        ),
      );
      router.refresh();
    } catch {
      patch(key, { status: "error", message: NETWORK_ERROR });
    }
  }

  const revert = (key: string) =>
    patch(key, { draft: latest.current[key]?.saved ?? "", status: "idle", message: "" });

  /** The status of a row now, from what is saved in its cells (so it updates after a save). */
  const rowStatus = (p: PolicyPerson) =>
    policyStatus(
      p.rates.map((r) => ({ rate: cells[cellKey(p.id, r.leaveTypeId)]?.saved ?? null })),
    );

  const field = (p: PolicyPerson, typeId: string, typeName: string, suffix: string) => {
    const key = cellKey(p.id, typeId);
    const cell = cells[key]!;
    return (
      <PolicyRateCell
        id={`rate-${p.id}-${typeId}-${suffix}`}
        label={`${typeName} days a month for ${p.name}`}
        cell={cell}
        onDraft={(draft) =>
          patch(key, { draft, status: cell.status === "busy" ? "busy" : "idle", message: "" })
        }
        onSave={() => void save(p.id, typeId)}
        onRevert={() => revert(key)}
      />
    );
  };

  const columns: SortColumn[] = [
    { sort: "name", label: "Employee" },
    ...types.map((t): SortColumn => ({
      sort: t.name === "Vacation" ? "vacation" : t.name === "Sick" ? "sick" : null,
      label: t.name,
      unit: "days/month",
      typeId: t.id,
    })),
    { sort: "changed", label: "Last changed" },
    { sort: null, label: "Status" },
  ];

  const go = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    navigate(href);
  };

  const header = (c: SortColumn): ReactNode => {
    const active = c.sort !== null && query.sort === c.sort;
    const ariaSort = active ? (query.dir === "asc" ? "ascending" : "descending") : undefined;
    const href = c.sort ? sortHref(query, c.sort) : null;
    return (
      <th key={c.label} scope="col" aria-sort={ariaSort} className={`${HEAD} text-left`}>
        {href ? (
          <a
            href={href}
            onClick={go(href)}
            className="inline-flex min-h-9 items-center gap-1 hover:text-ink"
          >
            <span>
              {c.label}
              {c.unit ? (
                <span className="block text-xs font-normal text-ink-muted">{c.unit}</span>
              ) : null}
            </span>
            <span aria-hidden="true">{active ? (query.dir === "asc" ? "▲" : "▼") : "↕"}</span>
            <span className="sr-only">
              {active ? `, sorted ${query.dir === "asc" ? "ascending" : "descending"}` : ", sort"}
            </span>
          </a>
        ) : (
          <span>
            {c.label}
            {c.unit ? (
              <span className="block text-xs font-normal text-ink-muted">{c.unit}</span>
            ) : null}
          </span>
        )}
      </th>
    );
  };

  const person = (p: PolicyPerson) => (
    <span className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600"
      >
        {initialsOf(p.name)}
      </span>
      <span className="min-w-0">
        <span className="block break-words font-medium text-ink [overflow-wrap:anywhere]">
          {p.name}
        </span>
        <span className="block break-words text-sm font-normal text-ink-muted [overflow-wrap:anywhere]">
          {p.managerName ? `Manager: ${p.managerName}` : "No manager"}
        </span>
      </span>
    </span>
  );

  return (
    <>
      <div className="hidden max-h-[70vh] overflow-auto rounded-xl border border-line xl:block">
        <table
          aria-label="Employees and their leave policies"
          className="w-full border-separate border-spacing-0 text-left"
        >
          <thead>
            <tr>{columns.map(header)}</tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="align-top hover:bg-brand-50/40">
                <th scope="row" className="border-b border-line px-3 py-3 text-left font-normal">
                  {person(p)}
                </th>
                {p.rates.map((r) => (
                  <td key={r.leaveTypeId} className="w-40 border-b border-line px-3 py-3">
                    {field(p, r.leaveTypeId, r.leaveTypeName, "t")}
                  </td>
                ))}
                <td className="border-b border-line px-3 py-3 text-sm text-ink-muted">
                  {formatLastChange(lastChanges[p.id] ?? null, timeZone)}
                </td>
                <td className="border-b border-line px-3 py-3">
                  <PolicyStatusBadge status={rowStatus(p)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul
        aria-label="Employees and their leave policies"
        className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden"
      >
        {rows.map((p) => (
          <li key={p.id} className="min-w-0 rounded-xl border border-line bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              {person(p)}
              <PolicyStatusBadge status={rowStatus(p)} />
            </div>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {p.rates.map((r) => (
                <div key={r.leaveTypeId} className="min-w-0">
                  <p className="mb-1 text-sm font-medium text-ink">{r.leaveTypeName}</p>
                  {field(p, r.leaveTypeId, r.leaveTypeName, "c")}
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              Last changed: {formatLastChange(lastChanges[p.id] ?? null, timeZone)}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
