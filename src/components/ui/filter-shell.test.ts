import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const { FilterShell, ResultsRegion, useFilterNav } = await import("./filter-shell");

describe("ResultsRegion (the results update in place)", () => {
  const render = () =>
    renderToStaticMarkup(
      createElement(
        FilterShell,
        null,
        createElement(ResultsRegion, null, createElement("p", null, "the rows")),
      ),
    );

  it("renders the results, not busy and not dimmed, when nothing is loading", () => {
    const out = render();
    expect(out).toContain("the rows");
    expect(out).toContain('aria-busy="false"');
    expect(out).not.toContain("opacity-50");
  });

  it("has a polite status region (empty until an update is loading) for screen readers", () => {
    expect(render()).toMatch(/<p role="status" class="sr-only"><\/p>/);
  });
});

describe("useFilterNav", () => {
  it("must be used inside the shell, so a missing shell fails loudly in development", () => {
    const Probe = () => {
      useFilterNav();
      return null;
    };
    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(/inside <FilterShell>/);
  });
});
