import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const { DayDialog } = await import("./day-dialog");

describe("DayDialog (EPIC-7)", () => {
  // createElement's children argument is how a test passes children without JSX.
  const Dialog = DayDialog as unknown as FunctionComponent<{ closeHref: string }>;
  const out = renderToStaticMarkup(
    createElement(Dialog, { closeHref: "/calendar" }, createElement("p", null, "who is out")),
  );

  it("is rendered open by the server, so the day shows without JavaScript", () => {
    expect(out).toMatch(/<dialog[^>]* open=""/);
    expect(out).toContain("who is out");
  });

  it("is named by the day heading", () => {
    expect(out).toContain('aria-labelledby="cal-day-heading"');
  });

  it("is a bottom sheet on phones and a centred card from sm, inside the screen", () => {
    expect(out).toContain("bottom-0");
    expect(out).toContain("sm:max-w-2xl");
    expect(out).toContain("max-h-[85dvh]");
  });
});
