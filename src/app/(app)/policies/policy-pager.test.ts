import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PolicyPager, pageWindow } from "./policy-pager";

const hrefFor = (n: number) => `/policies?page=${n}`;
const render = (page: number, total: number, pageSize = 25) =>
  renderToStaticMarkup(createElement(PolicyPager, { page, total, pageSize, hrefFor }));

describe("pageWindow", () => {
  it.each([
    [1, 1, [1]],
    [1, 3, [1, 2, 3]],
    [1, 50, [1, 2, null, 50]],
    [2, 50, [1, 2, 3, null, 50]],
    [25, 50, [1, null, 24, 25, 26, null, 50]],
    [50, 50, [1, null, 49, 50]],
    [3, 5, [1, 2, 3, 4, 5]],
  ])("page %i of %i", (page, pages, expected) => {
    expect(pageWindow(page, pages)).toEqual(expected);
  });
});

describe("PolicyPager", () => {
  it("says which rows are shown, with thousands separators", () => {
    expect(render(1, 1248)).toContain("Showing 1 to 25 of 1,248");
    expect(render(50, 1248)).toContain("Showing 1,226 to 1,248 of 1,248");
    expect(render(1, 0)).toContain("Showing 0 to 0 of 0");
  });

  it("marks the current page, links the others, and keeps the address", () => {
    const html = render(2, 100);
    expect(html).toMatch(/aria-current="page"[^>]*><span class="sr-only">Page <\/span>2/);
    expect(html).toContain('href="/policies?page=1"');
    expect(html).toContain('href="/policies?page=3"');
    expect(html).toContain('href="/policies?page=4"');
    expect(html).toMatch(/<nav[^>]*aria-label="Pagination"/);
  });

  it("Previous is disabled on the first page and Next on the last", () => {
    expect(render(1, 100)).toMatch(/<span[^>]*aria-disabled="true"[^>]*>Previous<\/span>/);
    expect(render(1, 100)).toMatch(/<a[^>]*>Next<\/a>/);
    expect(render(4, 100)).toMatch(/<span[^>]*aria-disabled="true"[^>]*>Next<\/span>/);
    expect(render(4, 100)).toMatch(/<a[^>]*>Previous<\/a>/);
  });

  it("shows only the range for a single page", () => {
    const html = render(1, 10);
    expect(html).toContain("Showing 1 to 10 of 10");
    expect(html).not.toContain("<ul");
  });

  it("every page link is at least 44px", () => {
    expect(render(2, 100)).toContain("min-h-11 min-w-11");
  });
});
