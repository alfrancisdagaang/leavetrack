"use client";

import Image from "next/image";
import { useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useFilterNav } from "@/components/ui/filter-shell";
import type { PolicyChoices } from "@/lib/leave/policies";
import {
  POLICY_PER_PAGE,
  POLICY_STATUSES,
  type PolicyListQuery,
  type PolicySort,
  type PolicyStatus,
} from "@/lib/leave/policies-schema";
import { clearedHref, filterChips, policiesHref, SORT_OPTIONS, STATUS_LABEL } from "./policies-url";

type Option = { value: string; label: string };

/** A labelled native select with the design's chevron; it applies as soon as it changes. */
function SelectField({
  id,
  label,
  name,
  options,
  value,
}: {
  id: string;
  label: string;
  name: string;
  options: readonly Option[];
  value: string;
}) {
  return (
    <Field id={id} label={label}>
      <div className="relative">
        <Select id={id} name={name} defaultValue={value} className="appearance-none pr-10">
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Image
          src="/icons/chevron-down.svg"
          alt=""
          width={16}
          height={16}
          unoptimized
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        />
      </div>
    </Field>
  );
}

/**
 * The search and filters (EPIC-13): name, team, leave type, status, sort and rows per page, with a
 * removable chip per applied filter. A select applies as soon as it changes and the search on Enter or
 * Search; every change starts again at page 1. Applying navigates on the client (see FilterShell), so
 * only the results change; the form is also a plain GET form with a no-script Apply button, so it works
 * without JavaScript. The form is re-created when the applied values change, so the fields always show
 * what is applied (also after the back button).
 */
export function PolicyFilters({
  query,
  choices,
}: {
  query: PolicyListQuery;
  choices: PolicyChoices;
}) {
  const { pending, navigate } = useFilterNav();
  // On a phone the five selects sit behind a "Filters" button (closed unless one is applied), so the
  // search box and the list are not pushed a screen down. From sm they are always shown.
  const [open, setOpen] = useState(() => Boolean(query.team || query.type || query.status));
  const chips = filterChips(query, {
    teams: Object.fromEntries(choices.managers.map((m) => [m.id, m.name])),
    types: Object.fromEntries(choices.leaveTypes.map((t) => [t.id, t.name])),
  });
  const cleared = clearedHref(query);

  const teams: Option[] = [
    { value: "", label: "All teams" },
    ...choices.managers.map((m) => ({ value: m.id, label: m.name })),
  ];
  const types: Option[] = [
    { value: "", label: "All types" },
    ...choices.leaveTypes.map((t) => ({ value: t.id, label: t.name })),
  ];
  const statuses: Option[] = [
    { value: "", label: "All statuses" },
    ...POLICY_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
  ];
  const perPage: Option[] = POLICY_PER_PAGE.map((n) => ({ value: String(n), label: String(n) }));

  const go = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    navigate(href);
  };

  function apply(form: HTMLFormElement) {
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? "");
    const [sort, dir] = value("order").split(":") as [PolicySort, "asc" | "desc"];
    navigate(
      policiesHref({
        q: value("q").trim() || undefined,
        page: 1,
        per: (Number(value("per")) as PolicyListQuery["per"]) || query.per,
        sort,
        dir,
        team: value("team") || undefined,
        type: value("type") || undefined,
        status: (value("status") || undefined) as PolicyStatus | undefined,
      }),
    );
  }

  return (
    <section
      aria-label="Search and filters"
      className="rounded-tile border border-brand-50 bg-white p-4 shadow-tile sm:p-5"
    >
      <form
        key={[query.q, query.team, query.type, query.status, query.sort, query.dir, query.per].join(
          "|",
        )}
        method="get"
        action="/policies"
        role="search"
        aria-label="Search and filter employees"
        onSubmit={(event) => {
          event.preventDefault();
          apply(event.currentTarget);
        }}
        onChange={(event) => {
          if (event.target instanceof HTMLSelectElement) apply(event.currentTarget);
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div className="sm:col-span-2 lg:col-span-3">
          <Field id="policy-q" label="Search employees by name">
            <div className="flex gap-2">
              <Input
                id="policy-q"
                name="q"
                type="search"
                maxLength={100}
                autoComplete="off"
                defaultValue={query.q ?? ""}
                className="min-w-0 flex-1"
              />
              <Button type="submit" pending={pending}>
                Search
              </Button>
            </div>
          </Field>
        </div>
        <div className="sm:col-span-2 lg:col-span-3 sm:hidden">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="policy-selects"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex min-h-11 w-full items-center justify-between rounded-lg border border-ink-muted bg-white px-3 text-sm font-semibold text-ink"
          >
            Filters and sort
            <Image
              src="/icons/chevron-down.svg"
              alt=""
              width={16}
              height={16}
              unoptimized
              className={open ? "rotate-180" : undefined}
            />
          </button>
        </div>
        <div
          id="policy-selects"
          className={`${open ? "grid" : "hidden"} grid-cols-1 gap-4 sm:col-span-2 sm:grid sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3 xl:grid-cols-5`}
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
        </div>
        <noscript>
          <Button type="submit">Apply</Button>
        </noscript>
      </form>

      {chips.length > 0 ? (
        <ul aria-label="Applied filters" className="mt-4 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <li key={chip.key}>
              <a
                href={chip.href}
                onClick={go(chip.href)}
                aria-label={`Remove filter ${chip.label}`}
                className="inline-flex min-h-9 items-center gap-2 rounded-full bg-brand-50 px-3 text-sm font-medium text-brand-600 hover:bg-brand-50/70"
              >
                {chip.label}
                <Image src="/icons/x.svg" alt="" width={14} height={14} unoptimized />
              </a>
            </li>
          ))}
          <li>
            <a
              href={cleared}
              onClick={go(cleared)}
              className="inline-flex min-h-9 items-center px-2 text-sm font-medium text-brand-600 hover:underline"
            >
              Clear all
            </a>
          </li>
        </ul>
      ) : null}
    </section>
  );
}
