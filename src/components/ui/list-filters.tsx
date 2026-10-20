"use client";

import Image from "next/image";
import { useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useFilterNav } from "@/components/ui/filter-shell";

export type SelectOption = { value: string; label: string };

/** A labelled native select with the design's chevron; inside a `FilterForm` it applies as soon as it changes. */
export function SelectField({
  id,
  label,
  name,
  options,
  value,
}: {
  id: string;
  label: string;
  name: string;
  options: readonly SelectOption[];
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
 * The form of a list's search and filters. A select or a date applies as soon as it changes and the search on Enter or
 * its button; `buildHref` turns the chosen values into the address (always page 1). Applying navigates on the
 * client inside the FilterShell, so only the results change; it is also a plain GET form with a no-script
 * Apply button, so it works without JavaScript. The form is re-created when `formKey` (the applied values)
 * changes, so the fields always show what is applied, also after the back button.
 */
export function FilterForm({
  formKey,
  action,
  label,
  buildHref,
  className = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
  children,
}: {
  formKey: string;
  action: string;
  label: string;
  buildHref: (data: FormData) => string;
  className?: string;
  children: ReactNode;
}) {
  const { navigate } = useFilterNav();
  const apply = (form: HTMLFormElement) => navigate(buildHref(new FormData(form)));
  return (
    <form
      key={formKey}
      method="get"
      action={action}
      role="search"
      aria-label={label}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        apply(event.currentTarget);
      }}
      onChange={(event) => {
        const t = event.target;
        // a select, or a date once it is a whole date (an empty one clears the filter), applies at once
        if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && t.type === "date"))
          apply(event.currentTarget);
      }}
      className={className}
    >
      {children}
      <noscript>
        <Button type="submit">Apply</Button>
      </noscript>
    </form>
  );
}

/** The name search with its button, across the whole form. */
export function SearchRow({
  id,
  label,
  defaultValue,
}: {
  id: string;
  label: string;
  defaultValue: string;
}) {
  const { pending } = useFilterNav();
  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <Field id={id} label={label}>
        <div className="flex gap-2">
          <Input
            id={id}
            name="q"
            type="search"
            maxLength={100}
            autoComplete="off"
            defaultValue={defaultValue}
            className="min-w-0 flex-1"
          />
          <Button type="submit" pending={pending}>
            Search
          </Button>
        </div>
      </Field>
    </div>
  );
}

/**
 * The selects of a filter form. On a phone they sit behind a "Filters and sort" button (closed unless a
 * filter is applied), so the search box and the list are not pushed a screen down; from `sm` they are always
 * shown. `gridClass` is the column layout from `sm` up.
 */
export function CollapsibleSelects({
  id,
  defaultOpen,
  gridClass,
  children,
}: {
  id: string;
  defaultOpen: boolean;
  gridClass: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <div className="sm:col-span-2 sm:hidden lg:col-span-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
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
        id={id}
        className={`${open ? "grid" : "hidden"} grid-cols-1 gap-4 sm:col-span-2 sm:grid sm:grid-cols-2 lg:col-span-3 ${gridClass}`}
      >
        {children}
      </div>
    </>
  );
}

export type FilterChip = { key: string; label: string; href: string };

/** One removable chip per applied filter, and "Clear all". A plain click navigates inside the FilterShell. */
export function FilterChips({
  chips,
  clearAllHref,
}: {
  chips: readonly FilterChip[];
  clearAllHref: string;
}) {
  const { navigate } = useFilterNav();
  if (chips.length === 0) return null;
  const go = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    navigate(href);
  };
  return (
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
          href={clearAllHref}
          onClick={go(clearAllHref)}
          className="inline-flex min-h-9 items-center px-2 text-sm font-medium text-brand-600 hover:underline"
        >
          Clear all
        </a>
      </li>
    </ul>
  );
}
