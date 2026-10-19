import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const { CloseLink, MemberDialog } = await import("./member-dialog");

describe("MemberDialog", () => {
  const Dialog = MemberDialog as unknown as FunctionComponent<{ closeHref: string }>;
  const out = renderToStaticMarkup(
    createElement(Dialog, { closeHref: "/approvals/team" }, createElement("p", null, "Elena")),
  );

  it("is rendered open by the server, so the person shows without JavaScript", () => {
    expect(out).toMatch(/<dialog[^>]* open=""/);
    expect(out).toContain("Elena");
  });

  it("is named by the person's heading", () => {
    expect(out).toContain('aria-labelledby="member-dialog-heading"');
  });

  it("is a bottom sheet on phones and a centred card from sm, inside the screen", () => {
    expect(out).toContain("bottom-0");
    expect(out).toContain("sm:max-w-4xl");
    expect(out).toContain("max-h-[90dvh]");
  });

  it("has a Close link that goes back to the plain My Team page, at least 44 px square", () => {
    const link = renderToStaticMarkup(createElement(CloseLink, { href: "/approvals/team" }));
    expect(link).toMatch(
      /<a [^>]*href="\/approvals\/team"[^>]*aria-label="Close"|aria-label="Close"[^>]*href="\/approvals\/team"/,
    );
    expect(link).toContain("size-11");
  });
});
