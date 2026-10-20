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
import type { OverrideListQuery, OverrideSort } from "@/lib/leave/override-list-schema";
import type { OverrideChoices } from "@/lib/leave/override-lists";
import { clearedHref, filterChips, overridesHref, SORT_OPTIONS } from "./overrides-url";

/**
 * Balance Overrides' search and filters (EPIC-14): name, leave type, team (the employee's manager), the leave
 * dates, sort and rows per page, with a removable chip per applied filter. See the shared `FilterForm` for how
 * they apply.
 */
export function OverridesFilters({
  query,
  choices,
}: {
  query: OverrideListQuery;
  choices: OverrideChoices;
}) {
  const chips = filterChips(query, {
    types: Object.fromEntries(choices.leaveTypes.map((t) => [t.id, t.name])),
    teams: Object.fromEntries(choices.managers.map((m) => [m.id, m.name])),
  });

  const types: SelectOption[] = [
    { value: "", label: "All types" },
    ...choices.leaveTypes.map((t) => ({ value: t.id, label: t.name })),
  ];
  const teams: SelectOption[] = [
    { value: "", label: "All teams" },
    ...choices.managers.map((m) => ({ value: m.id, label: m.name })),
  ];
  const perPage: SelectOption[] = LIST_PER_PAGE.map((n) => ({
    value: String(n),
    label: String(n),
  }));

  const buildHref = (data: FormData) => {
    const value = (name: string) => String(data.get(name) ?? "");
    const [sort, dir] = value("order").split(":") as [OverrideSort, "asc" | "desc"];
    return overridesHref({
      view: query.view,
      q: value("q").trim() || undefined,
      page: 1,
      per: (Number(value("per")) as OverrideListQuery["per"]) || query.per,
      type: value("type") || undefined,
      team: value("team") || undefined,
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
          query.team,
          query.from,
          query.to,
          query.sort,
          query.dir,
          query.per,
        ].join("|")}
        action="/approvals/overrides"
        label="Search and filter requests"
        buildHref={buildHref}
      >
        <SearchRow id="overrides-q" label="Search by employee name" defaultValue={query.q ?? ""} />
        <CollapsibleSelects
          id="overrides-selects"
          defaultOpen={Boolean(query.type || query.team || query.from || query.to)}
          gridClass="lg:grid-cols-3"
        >
          <SelectField
            id="overrides-type"
            label="Leave type"
            name="type"
            options={types}
            value={query.type ?? ""}
          />
          <SelectField
            id="overrides-team"
            label="Team (manager)"
            name="team"
            options={teams}
            value={query.team ?? ""}
          />
          <SelectField
            id="overrides-order"
            label="Sort by"
            name="order"
            options={SORT_OPTIONS[query.view]}
            value={`${query.sort}:${query.dir}`}
          />
          <Field id="overrides-from" label="Leave from">
            <Input id="overrides-from" name="from" type="date" defaultValue={query.from ?? ""} />
          </Field>
          <Field id="overrides-to" label="Leave to">
            <Input id="overrides-to" name="to" type="date" defaultValue={query.to ?? ""} />
          </Field>
          <SelectField
            id="overrides-per"
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
