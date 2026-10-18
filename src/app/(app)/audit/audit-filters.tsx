"use client";

import Image from "next/image";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useFilterNav } from "@/components/ui/filter-shell";
import type { AuditFilterChoices } from "@/lib/leave/audit-list";
import { AUDIT_STATUSES, type AuditListQuery } from "@/lib/leave/schemas";
import { auditHref, filterChips, filtersHref, STATUS_LABEL } from "./audit-url";

type Option = { value: string; label: string };

/** A labelled native select with the design's chevron (the native arrow is hidden). */
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
 * US-14. The audit list filters: a name search, leave type, status, decided by, and a date range, with
 * Apply filters, Clear filters and a removable chip per applied filter. Applying navigates on the
 * client (see FilterShell), so only the results change; the form is also a plain GET form, so it works
 * without JavaScript. A change starts again at page 1. The form is re-created when the applied filters
 * change, so the fields always show what is applied (also after the back button).
 */
export function AuditFilters({
  query,
  choices,
}: {
  query: AuditListQuery;
  choices: AuditFilterChoices;
}) {
  const { pending, navigate } = useFilterNav();
  const chips = filterChips(query, choices);
  const base = auditHref({
    ...query,
    q: undefined,
    leaveTypeId: undefined,
    status: undefined,
    decidedBy: undefined,
    from: undefined,
    to: undefined,
    page: 1,
  });

  const types: Option[] = [
    { value: "", label: "All leave types" },
    ...choices.leaveTypes.map((t) => ({ value: t.id, label: t.name })),
  ];
  const statuses: Option[] = [
    { value: "", label: "All statuses" },
    ...AUDIT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
  ];
  const deciders: Option[] = [
    { value: "", label: "Anyone" },
    ...choices.deciders.map((d) => ({ value: d.id, label: d.name })),
  ];

  /** A plain click navigates on the client; a modified click (new tab, etc.) keeps its normal meaning. */
  const go = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    navigate(href);
  };

  return (
    <section
      aria-labelledby="audit-filters-heading"
      className="mb-6 rounded-tile border border-brand-50 bg-white p-4 shadow-tile sm:p-6"
    >
      <h2 id="audit-filters-heading" className="mb-4 text-xl font-semibold text-ink">
        Filters
      </h2>

      <form
        key={[query.q, query.leaveTypeId, query.status, query.decidedBy, query.from, query.to].join(
          "|",
        )}
        method="get"
        action="/audit"
        aria-label="Filter audit log"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const value = (name: string) => String(data.get(name) ?? "");
          navigate(
            filtersHref({
              q: value("q"),
              type: value("type"),
              status: value("status"),
              by: value("by"),
              from: value("from"),
              to: value("to"),
            }),
          );
        }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="sm:col-span-2 lg:col-span-4">
          <Field id="audit-filter-q" label="Employee name">
            <Input
              id="audit-filter-q"
              name="q"
              type="search"
              maxLength={60}
              autoComplete="off"
              list="audit-employee-names"
              placeholder="Search employee name"
              defaultValue={query.q ?? ""}
            />
          </Field>
        </div>
        <datalist id="audit-employee-names">
          {choices.employeeNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <SelectField
          id="audit-filter-type"
          label="Leave type"
          name="type"
          options={types}
          value={query.leaveTypeId ?? ""}
        />
        <SelectField
          id="audit-filter-status"
          label="Status"
          name="status"
          options={statuses}
          value={query.status ?? ""}
        />
        <SelectField
          id="audit-filter-by"
          label="Decided by"
          name="by"
          options={deciders}
          value={query.decidedBy ?? ""}
        />
        <div className="hidden lg:block" aria-hidden="true" />
        <Field id="audit-filter-from" label="From (optional)">
          <Input id="audit-filter-from" name="from" type="date" defaultValue={query.from ?? ""} />
        </Field>
        <Field
          id="audit-filter-to"
          label="To (optional)"
          hint="Days are UTC; a request matches if any event on it falls in the range."
        >
          <Input
            id="audit-filter-to"
            name="to"
            type="date"
            defaultValue={query.to ?? ""}
            aria-describedby="audit-filter-to-hint"
          />
        </Field>
        <div className="flex flex-col gap-1 sm:col-span-2 sm:flex-row sm:items-center sm:gap-4 lg:col-span-4">
          <Button type="submit" pending={pending} className="w-full sm:w-auto">
            Apply filters
          </Button>
          <a
            href={base}
            onClick={go(base)}
            className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-brand-600 hover:underline sm:justify-start"
          >
            Clear filters
          </a>
        </div>
      </form>

      {chips.length > 0 ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-sm font-semibold text-ink sm:sr-only">Applied filters</p>
          <ul aria-label="Applied filters" className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <li key={chip.key}>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-ink">
                  {chip.label}
                  <a
                    href={chip.removeHref}
                    onClick={go(chip.removeHref)}
                    aria-label={`Remove filter ${chip.label}`}
                    className="inline-flex size-6 items-center justify-center rounded-full text-base leading-none hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
                  >
                    <span aria-hidden="true">×</span>
                  </a>
                </span>
              </li>
            ))}
            <li>
              <a
                href={base}
                onClick={go(base)}
                className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-brand-600 hover:underline"
              >
                Clear all
              </a>
            </li>
          </ul>
        </div>
      ) : null}
    </section>
  );
}
