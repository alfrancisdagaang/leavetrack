import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PolicySummaryTiles } from "./policy-summary";

const html = renderToStaticMarkup(
  createElement(PolicySummaryTiles, {
    summary: { employees: 1248, noPolicy: 37, changedThisMonth: 12 },
  }),
);

describe("PolicySummaryTiles", () => {
  it("shows the three company-wide numbers with their labels", () => {
    expect(html).toContain("1,248");
    expect(html).toContain("employees");
    expect(html).toContain(">37<");
    expect(html).toContain("with no policy yet");
    expect(html).toContain(">12<");
    expect(html).toContain("changed this month");
  });

  it("the second and third tiles are links to the matching filter, the first is not", () => {
    expect(html).toContain('href="/policies?status=none"');
    expect(html).toContain('href="/policies?status=changed"');
    expect(html.match(/<a /g)).toHaveLength(2);
  });

  it("is a labelled region, and says 'employee' for one", () => {
    expect(html).toContain('aria-label="Summary"');
    expect(
      renderToStaticMarkup(
        createElement(PolicySummaryTiles, {
          summary: { employees: 1, noPolicy: 0, changedThisMonth: 0 },
        }),
      ),
    ).toContain(">employee<");
  });
});
