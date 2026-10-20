"use client";

import { Field, Input } from "@/components/ui/field";
import {
  CollapsibleSelects,
  FilterChips,
  FilterForm,
  SearchRow,
  SelectField,
  type SelectOption,
} from "@/components/ui/list-filters";
import { LIST_PER_PAGE } from "@/lib/leave/list-query";
import {
  TEAM_DECIDED_STATUSES,
  TEAM_PENDING_STATUSES,
  type TeamQueueQuery,
  type TeamSort,
} from "@/lib/leave/team-queue-schema";
import {
  approvalsHref,
  clearedHref,
  DECIDED_STATUS_LABEL,
  filterChips,
  PENDING_STATUS_LABEL,
  SORT_OPTIONS,
} from "./approvals-url";

/**
 * Team Approvals' search and filters (EPIC-14): name, leave type, status, the leave dates, sort and rows per
 * page, with a removable chip per applied filter. The statuses and sorts depend on the view. See the shared
 * `FilterForm` for how they apply.
 */
export function ApprovalsFilters({
  query,
  leaveTypes,
}: {
  query: TeamQueueQuery;
  leaveTypes: { id: string; name: string }[];
}) {
  const chips = filterChips(query, {
    types: Object.fromEntries(leaveTypes.map((t) => [t.id, t.name])),
  });

  const types: SelectOption[] = [
    { value: "", label: "All types" },
    ...leaveTypes.map((t) => ({ value: t.id, label: t.name })),
  ];
  const statuses: SelectOption[] = [
    { value: "", label: "All statuses" },
    ...(query.view === "pending"
      ? TEAM_PENDING_STATUSES.map((s) => ({ value: s, label: PENDING_STATUS_LABEL[s] }))
      : TEAM_DECIDED_STATUSES.map((s) => ({ value: s, label: DECIDED_STATUS_LABEL[s] }))),
  ];
  const perPage: SelectOption[] = LIST_PER_PAGE.map((n) => ({
    value: String(n),
    label: String(n),
  }));

  const buildHref = (data: FormData) => {
    const value = (name: string) => String(data.get(name) ?? "");
    const [sort, dir] = value("order").split(":") as [TeamSort, "asc" | "desc"];
    return approvalsHref({
      view: query.view,
      q: value("q").trim() || undefined,
      page: 1,
      per: (Number(value("per")) as TeamQueueQuery["per"]) || query.per,
      type: value("type") || undefined,
      status: (value("status") || undefined) as TeamQueueQuery["status"],
      from: value("from") || undefined,
      to: value("to") || undefined,
      sort,
      dir,
    });
  };

  return (
    <section
      aria-label="Search and filters"
      className="rounded-tile border border-brand-50 bg-white p-4 shadow-tile sm:p-5"
    >
      <FilterForm
        formKey={[
          query.view,
          query.q,
          query.type,
          query.status,
          query.from,
          query.to,
          query.sort,
          query.dir,
          query.per,
        ].join("|")}
        action="/approvals"
        label="Search and filter requests"
        buildHref={buildHref}
      >
        <SearchRow id="approvals-q" label="Search by employee name" defaultValue={query.q ?? ""} />
        <CollapsibleSelects
          id="approvals-selects"
          defaultOpen={Boolean(query.type || query.status || query.from || query.to)}
          gridClass="lg:grid-cols-3"
        >
          <SelectField
            id="approvals-type"
            label="Leave type"
            name="type"
            options={types}
            value={query.type ?? ""}
          />
          <SelectField
            id="approvals-status"
            label="Status"
            name="status"
            options={statuses}
            value={query.status ?? ""}
          />
          <SelectField
            id="approvals-order"
            label="Sort by"
            name="order"
            options={SORT_OPTIONS[query.view]}
            value={`${query.sort}:${query.dir}`}
          />
          <Field id="approvals-from" label="Leave from">
            <Input id="approvals-from" name="from" type="date" defaultValue={query.from ?? ""} />
          </Field>
          <Field id="approvals-to" label="Leave to">
            <Input id="approvals-to" name="to" type="date" defaultValue={query.to ?? ""} />
          </Field>
          <SelectField
            id="approvals-per"
            label="Rows per page"
            name="per"
            options={perPage}
            value={String(query.per)}
          />
        </CollapsibleSelects>
      </FilterForm>
      <FilterChips chips={chips} clearAllHref={clearedHref(query)} />
    </section>
  );
}
