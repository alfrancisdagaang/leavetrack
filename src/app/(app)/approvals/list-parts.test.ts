import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FilterShell } from "@/components/ui/filter-shell";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
const { ListError, ListNoMatches, TableShell, Th } = await import("./list-parts");
const h = createElement as unknown as (
  type: unknown,
  props: unknown,
  ...children: unknown[]
) => ReactElement;

describe("TableShell and Th", () => {
  const html = renderToStaticMarkup(
    createElement(
      FilterShell,
      null,
      h(
        TableShell,
        { label: "Things" },
        createElement(
          "thead",
          null,
          createElement(
            "tr",
            null,
            h(Th, {}, "Plain"),
            h(Th, { sort: { href: "/x?sort=a", direction: "asc" } }, "Sorted"),
            h(Th, { sort: { href: "/x?sort=b", direction: null } }, "Other"),
          ),
        ),
      ),
    ),
  );

  it("is hidden below xl, scrolls inside itself with a height limit and labels the table", () => {
    expect(html).toMatch(/<div class="hidden[^"]*max-h-\[75vh\][^"]*overflow-auto[^"]*xl:block"/);
    expect(html).toContain('<table aria-label="Things"');
  });

  it("every header has scope=col and a sticky style; only the sorted one has aria-sort", () => {
    expect(html.match(/scope="col"/g)).toHaveLength(3);
    expect(html.match(/sticky top-0/g)).toHaveLength(3);
    expect(html.match(/aria-sort="ascending"/g)).toHaveLength(1);
    expect(html).not.toContain('aria-sort="descending"');
  });

  it("a sortable header is a link, a plain one is text", () => {
    expect(html).toContain('href="/x?sort=a"');
    expect(html).toContain('href="/x?sort=b"');
    expect(html).toMatch(/>Plain<\/th>/);
  });
});

describe("ListNoMatches and ListError", () => {
  it("no matches says so as a status with a Clear filters button", () => {
    const html = renderToStaticMarkup(
      createElement(ListNoMatches, { clearHref: "/approvals", what: "pending requests" }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("No pending requests match these filters.");
    expect(html).toMatch(/<a[^>]*href="\/approvals"[^>]*>Clear filters<\/a>/);
  });

  it("an error is an alert with a Try again link that keeps the address", () => {
    const html = renderToStaticMarkup(
      createElement(ListError, { what: "Pending requests", retryHref: "/approvals?q=a&page=2" }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Pending requests could not be loaded right now.");
    expect(html).toContain("/approvals?q=a&amp;page=2");
  });
});
