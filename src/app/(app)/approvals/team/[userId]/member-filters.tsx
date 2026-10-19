"use client";

import Image from "next/image";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import type { TeamMemberQuery } from "@/lib/leave/schemas";
import { useFilterNav } from "@/components/ui/filter-shell";
import { filterChips, filtersHref } from "./member-url";

type Option = { value: string; label: string };

/** A labelled native select with a leading icon and the design's chevron (the native arrow is hidden). */
function SelectField({
  id,
  label,
  name,
  icon,
  options,
  value,
}: {
  id: string;
  label: string;
  name: string;
  icon: string;
  options: readonly Option[];
  value: string;
}) {
  return (
    <Field id={id} label={label}>
      <div className="relative">
        <Image
          src={icon}
          alt=""
          width={20}
          height={20}
          unoptimized
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        />
        <Select id={id} name={name} defaultValue={value} className="appearance-none pl-11 pr-10">
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
 * US-13 AC2. The leave type, status and year filters: three selects, Apply filters, Clear filters,
 * and a chip for each applied filter that removes just that filter. Applying navigates on the client
 * (see FilterShell), so only the results change; the form is also a plain GET form, so it works
 * without JavaScript. A change starts again at page 1. The form is re-created when the applied filters
 * change, so the selects always show what is applied (also after the back button).
 */
export function MemberFilters({
  memberId,
  query,
  leaveTypes,
  currentYear,
  popup = false,
}: {
  memberId: string;
  query: TeamMemberQuery;
  leaveTypes: readonly { id: string; name: string }[];
  currentYear: number;
  /** True inside the My Team popup: every address keeps `?member=<id>` so the popup stays open. */
  popup?: boolean;
}) {
  const { pending, navigate } = useFilterNav();
  const base = popup ? `/approvals/team?member=${memberId}` : `/approvals/team/${memberId}`;
  const chips = filterChips(memberId, query, leaveTypes, currentYear, popup);

  const types: Option[] = [
    { value: "", label: "All leave types" },
    ...leaveTypes.map((t) => ({ value: t.id, label: t.name })),
  ];
  const statuses: Option[] = [
    { value: "", label: "All statuses" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];
  const years: Option[] = [currentYear, currentYear - 1, currentYear - 2].map((y) => ({
    value: String(y),
    label: String(y),
  }));

  /** A plain click navigates on the client; a modified click (new tab, etc.) keeps its normal meaning. */
  const go = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    navigate(href);
  };

  return (
    <section
      aria-labelledby="member-filters-heading"
      className="mb-6 rounded-tile border border-brand-50 bg-white p-4 shadow-tile sm:p-6"
    >
      <h2 id="member-filters-heading" className="mb-4 text-xl font-semibold text-ink">
        Filters
      </h2>

      <form
        key={`${query.leaveTypeId ?? ""}|${query.status ?? ""}|${query.year}`}
        method="get"
        action={popup ? "/approvals/team" : base}
        aria-label="Filter requests"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          navigate(
            filtersHref(
              memberId,
              {
                type: String(data.get("type") ?? ""),
                status: String(data.get("status") ?? ""),
                year: String(data.get("year") ?? ""),
              },
              currentYear,
              popup,
            ),
          );
        }}
        className="grid gap-4 sm:grid-cols-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] lg:items-end"
      >
        {popup ? <input type="hidden" name="member" value={memberId} /> : null}
        <SelectField
          id="member-filter-type"
          label="Leave type"
          name="type"
          icon="/icons/calendar-days.svg"
          options={types}
          value={query.leaveTypeId ?? ""}
        />
        <SelectField
          id="member-filter-status"
          label="Status"
          name="status"
          icon="/icons/clock.svg"
          options={statuses}
          value={query.status ?? ""}
        />
        <SelectField
          id="member-filter-year"
          label="Year"
          name="year"
          icon="/icons/calendar-days.svg"
          options={years}
          value={String(query.year)}
        />
        <div className="flex flex-col gap-1 sm:col-span-3 sm:flex-row sm:items-center sm:gap-4 lg:col-span-1">
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
