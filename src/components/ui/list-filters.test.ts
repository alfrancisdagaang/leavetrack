import { readFileSync } from "node:fs";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FilterShell } from "@/components/ui/filter-shell";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
const { CollapsibleSelects, FilterChips, FilterForm, SearchRow, SelectField } =
  await import("./list-filters");
const source = readFileSync(new URL("./list-filters.tsx", import.meta.url), "utf8");

const h = createElement as unknown as (
  type: unknown,
  props: unknown,
  ...children: unknown[]
) => ReactElement;
const shell = (child: ReactElement) =>
  renderToStaticMarkup(createElement(FilterShell, null, child));

describe("SelectField", () => {
  it("is a labelled select with the chevron and the applied value selected", () => {
    const html = renderToStaticMarkup(
      createElement(SelectField, {
        id: "f-type",
        label: "Leave type",
        name: "type",
        options: [
          { value: "", label: "All types" },
          { value: "v", label: "Vacation" },
        ],
        value: "v",
      }),
    );
    expect(html).toMatch(/<label[^>]*for="f-type"[^>]*>Leave type<\/label>/);
    expect(html).toMatch(/<select[^>]*id="f-type"[^>]*name="type"/);
    expect(html).toMatch(/<option value="v" selected/);
    expect(html).toContain("chevron-down.svg");
  });
});

describe("FilterForm", () => {
  const html = shell(
    h(
      FilterForm,
      { formKey: "k", action: "/x", label: "Filter things", buildHref: () => "/x" },
      createElement("p", null, "fields"),
    ),
  );

  it("is a search form that is also a plain GET form, with a no-script Apply button", () => {
    expect(html).toMatch(/<form[^>]*method="get"/);
    expect(html).toMatch(/<form[^>]*action="\/x"/);
    expect(html).toContain('role="search"');
    expect(html).toContain('aria-label="Filter things"');
    expect(html).toContain("<noscript>");
    expect(html).toContain("fields");
  });

  it("applies a select or a date as soon as it changes and the search on submit, through the FilterShell", () => {
    expect(source).toContain("t instanceof HTMLSelectElement");
    expect(source).toContain('t instanceof HTMLInputElement && t.type === "date"');
    expect(source).toMatch(
      /onSubmit=\{\(event: FormEvent<HTMLFormElement>\) => \{\s*event\.preventDefault\(\);\s*apply\(event\.currentTarget\);/,
    );
    expect(source).toContain("navigate(buildHref(new FormData(form)))");
  });
});

describe("SearchRow", () => {
  it("is a labelled search input named q with its value and a Search button", () => {
    const html = shell(
      createElement(SearchRow, { id: "s", label: "Search employees by name", defaultValue: "ana" }),
    );
    expect(html).toMatch(/<label[^>]*for="s"[^>]*>Search employees by name<\/label>/);
    expect(html).toMatch(/<input[^>]*id="s"[^>]*name="q"/);
    expect(html).toContain('value="ana"');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Search<\/button>/);
  });
});

describe("CollapsibleSelects", () => {
  const render = (defaultOpen: boolean) =>
    renderToStaticMarkup(
      h(
        CollapsibleSelects,
        { id: "sel", defaultOpen, gridClass: "lg:grid-cols-3" },
        createElement("p", null, "selects"),
      ),
    );

  it("starts closed on a phone and says so, and open when a filter is applied", () => {
    const closed = render(false);
    expect(closed).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="sel"/);
    expect(closed).toMatch(/id="sel"[^>]*class="hidden[^"]*sm:grid[^"]*lg:grid-cols-3/);
    const open = render(true);
    expect(open).toMatch(/<button[^>]*aria-expanded="true"/);
    expect(open).toMatch(/id="sel"[^>]*class="grid /);
  });

  it("the toggle is only for phones and is 44px tall", () => {
    const html = render(false);
    expect(html).toContain("sm:hidden");
    expect(html).toContain("min-h-11");
  });
});

describe("FilterChips", () => {
  it("has one removable chip per filter and Clear all", () => {
    const html = shell(
      createElement(FilterChips, {
        chips: [
          { key: "a", label: "Name: ana", href: "/x?a" },
          { key: "b", label: "Status: Pending", href: "/x?b" },
        ],
        clearAllHref: "/x",
      }),
    );
    expect(html).toContain('aria-label="Remove filter Name: ana"');
    expect(html).toContain('aria-label="Remove filter Status: Pending"');
    expect(html).toContain('href="/x?a"');
    expect(html).toContain("Clear all");
    expect(html).toMatch(/aria-label="Applied filters"/);
  });

  it("renders nothing without chips", () => {
    expect(shell(createElement(FilterChips, { chips: [], clearAllHref: "/x" }))).not.toContain(
      "Applied filters",
    );
  });
});
