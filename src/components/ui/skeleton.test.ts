import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Loading from "@/app/(app)/loading";
import { Skeleton } from "@/components/ui/skeleton";

describe("Skeleton", () => {
  it("is decorative, uses a token colour and only pulses when motion is allowed", () => {
    const html = renderToStaticMarkup(createElement(Skeleton, { className: "h-4 w-10" }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("bg-grey-200");
    expect(html).toContain("motion-safe:animate-pulse");
    expect(html).toContain("h-4 w-10");
  });
});

describe("app loading state", () => {
  const html = renderToStaticMarkup(createElement(Loading));

  it("announces itself to screen readers as a busy status", () => {
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('<span class="sr-only">Loading…</span>');
  });

  it("hides the purely visual placeholder blocks from assistive technology", () => {
    const blocks = html.match(/aria-hidden="true"/g) ?? [];
    expect(blocks.length).toBeGreaterThan(0);
    expect(html).not.toContain("<h1");
  });

  it("uses design tokens only (no hard-coded colours)", () => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(/);
  });
});
