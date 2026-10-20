"use client";

import {
  CollapsibleSelects,
  FilterChips,
  FilterForm,
  SearchRow,
  SelectField,
  type SelectOption,
} from "@/components/ui/list-filters";
import type { PolicyChoices } from "@/lib/leave/policies";
import {
  POLICY_PER_PAGE,
  POLICY_STATUSES,
  type PolicyListQuery,
  type PolicySort,
  type PolicyStatus,
} from "@/lib/leave/policies-schema";
import { clearedHref, filterChips, policiesHref, SORT_OPTIONS, STATUS_LABEL } from "./policies-url";

/**
 * The search and filters (EPIC-13): name, team, leave type, status, sort and rows per page, with a
 * removable chip per applied filter. See the shared `FilterForm` for how they apply.
 */
export function PolicyFilters({
  query,
  choices,
}: {
  query: PolicyListQuery;
  choices: PolicyChoices;
}) {
  const chips = filterChips(query, {
    teams: Object.fromEntries(choices.managers.map((m) => [m.id, m.name])),
    types: Object.fromEntries(choices.leaveTypes.map((t) => [t.id, t.name])),
  });

  const teams: SelectOption[] = [
    { value: "", label: "All teams" },
    ...choices.managers.map((m) => ({ value: m.id, label: m.name })),
  ];
  const types: SelectOption[] = [
    { value: "", label: "All types" },
    ...choices.leaveTypes.map((t) => ({ value: t.id, label: t.name })),
  ];
  const statuses: SelectOption[] = [
    { value: "", label: "All statuses" },
    ...POLICY_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
  ];
  const perPage: SelectOption[] = POLICY_PER_PAGE.map((n) => ({
    value: String(n),
    label: String(n),
  }));

  const buildHref = (data: FormData) => {
    const value = (name: string) => String(data.get(name) ?? "");
    const [sort, dir] = value("order").split(":") as [PolicySort, "asc" | "desc"];
    return policiesHref({
      q: value("q").trim() || undefined,
      page: 1,
      per: (Number(value("per")) as PolicyListQuery["per"]) || query.per,
      sort,
      dir,
      team: value("team") || undefined,
      type: value("type") || undefined,
      status: (value("status") || undefined) as PolicyStatus | undefined,
    });
  };

  return (
    <section
      aria-label="Search and filters"
      className="rounded-tile border border-brand-50 bg-white p-4 shadow-tile sm:p-5"
    >
      <FilterForm
        formKey={[
          query.q,
          query.team,
          query.type,
          query.status,
          query.sort,
          query.dir,
          query.per,
        ].join("|")}
        action="/policies"
        label="Search and filter employees"
        buildHref={buildHref}
      >
        <SearchRow id="policy-q" label="Search employees by name" defaultValue={query.q ?? ""} />
        <CollapsibleSelects
          id="policy-selects"
          defaultOpen={Boolean(query.team || query.type || query.status)}
          gridClass="lg:grid-cols-3 xl:grid-cols-5"
        >
          <SelectField
            id="policy-team"
            label="Team (manager)"
            name="team"
            options={teams}
            value={query.team ?? ""}
          />
          <SelectField
            id="policy-type"
            label="Leave type"
            name="type"
            options={types}
            value={query.type ?? ""}
          />
          <SelectField
            id="policy-status"
            label="Status"
            name="status"
            options={statuses}
            value={query.status ?? ""}
          />
          <SelectField
            id="policy-order"
            label="Sort by"
            name="order"
            options={SORT_OPTIONS}
            value={`${query.sort}:${query.dir}`}
          />
          <SelectField
            id="policy-per"
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
