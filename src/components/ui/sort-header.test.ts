import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FilterShell } from "@/components/ui/filter-shell";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
const { SortHeader } = await import("./sort-header");
const h = createElement as unknown as (
  type: unknown,
  props: unknown,
  ...children: unknown[]
) => ReactElement;

const render = (direction: "asc" | "desc" | null) =>
  renderToStaticMarkup(
    createElement(
      FilterShell,
      null,
      h(SortHeader, { href: "/x?sort=name", direction }, "Employee"),
    ),
  );

describe("SortHeader", () => {
  it("is a link to the sorted address with the column name", () => {
    const html = render(null);
    expect(html).toMatch(/<a href="\/x\?sort=name"/);
    expect(html).toContain("Employee");
  });

  it("says in words (not only an arrow) how the column is sorted", () => {
    expect(render(null)).toContain(", sort");
    expect(render("asc")).toContain(", sorted ascending");
    expect(render("desc")).toContain(", sorted descending");
    expect(render("asc")).toContain("▲");
    expect(render("desc")).toContain("▼");
    expect(render(null)).toContain("↕");
  });

  it("the arrow is hidden from screen readers and the target is 36px or taller", () => {
    const html = render("asc");
    expect(html).toMatch(/aria-hidden="true">▲/);
    expect(html).toContain("min-h-9");
  });
});
