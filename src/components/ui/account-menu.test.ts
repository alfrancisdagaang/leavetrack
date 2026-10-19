import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type * as ReactModule from "react";

// The menu opens from client state. Server rendering cannot click, so the one piece of state is
// pinned to "open on this page" to render the panel.
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactModule>()),
  useState: () => ["/dashboard", () => {}],
}));

const { AccountMenu } = await import("@/components/ui/account-menu");

const html = renderToStaticMarkup(
  createElement(AccountMenu, {
    name: "Marco Santos",
    roleLabel: "Manager",
    email: "marco.santos@leavetrack.example",
    signOutAction: async () => {},
  }),
);

describe("AccountMenu when open (TASK-062 AC5)", () => {
  it("has a Profile link to /profile, before Sign out", () => {
    expect(html).toMatch(/<a[^>]*href="\/profile"[^>]*>.*Profile<\/a>/);
    expect(html.indexOf("Profile</a>")).toBeLessThan(html.indexOf("Sign out"));
  });

  it("makes the link at least 44px tall and keeps Sign out", () => {
    expect(html).toMatch(/<a(?=[^>]*href="\/profile")(?=[^>]*class="[^"]*min-h-11)[^>]*>/);
    expect(html).toContain("Sign out");
  });
});
