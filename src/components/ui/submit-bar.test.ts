import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubmitBar } from "@/components/ui/submit-bar";

const render = (over: Partial<ComponentProps<typeof SubmitBar>> = {}) =>
  renderToStaticMarkup(
    createElement(SubmitBar, {
      pending: false,
      blocked: false,
      overBalance: false,
      error: null,
      ...over,
    }),
  );

describe("SubmitBar", () => {
  it("idle: an enabled primary Submit request button", () => {
    const out = render();
    expect(out).toContain('type="submit"');
    expect(out).toContain("Submit request");
    expect(out).not.toMatch(/<button[^>]*disabled/);
    expect(out).not.toContain("aria-busy");
    expect(out).toContain("bg-brand-500");
  });

  it("is a sticky bottom bar on mobile and sits in the card from sm up", () => {
    const out = render();
    expect(out).toContain("fixed inset-x-0 bottom-0");
    expect(out).toContain("sm:static");
    expect(out).toContain("env(safe-area-inset-bottom)");
  });

  it("submitting (Figma 08): disabled, busy, spinner and 'Submitting…'", () => {
    const out = render({ pending: true });
    expect(out).toContain("Submitting…");
    expect(out).toContain('aria-busy="true"');
    expect(out).toMatch(/<button[^>]*disabled/);
    expect(out).toContain("loader-circle.svg");
    expect(out).toContain("motion-safe:animate-spin");
  });

  it("blocked (Figma 07): really disabled, muted, with a lock", () => {
    const out = render({ blocked: true });
    expect(out).toMatch(/<button[^>]*disabled/);
    expect(out).toContain("lock.svg");
    expect(out).toContain("cursor-not-allowed");
    expect(out).toContain("bg-page");
    expect(out).toContain("Submit request");
  });

  it("over balance (Figma 06): shows the note and never disables the button", () => {
    const out = render({ overBalance: true });
    expect(out).toContain("Over your available balance");
    expect(out).toContain("triangle-alert.svg");
    expect(out).not.toMatch(/<button[^>]*disabled/);
  });

  it("server error (Figma 09): an alert with the message, linked by id, button still enabled", () => {
    const out = render({ error: "Could not reach the server. Please try again." });
    expect(out).toContain('id="request-error"');
    expect(out).toContain('role="alert"');
    expect(out).toContain("Could not reach the server. Please try again.");
    expect(out).toContain("circle-alert.svg");
    expect(out).not.toMatch(/<button[^>]*disabled/);
  });

  it("shows neither note nor error by default", () => {
    const out = render();
    expect(out).not.toContain("Over your available balance");
    expect(out).not.toContain('role="alert"');
  });
});
