import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProfileTabs, type ProfileTab } from "./profile-tabs";

const html = (active: ProfileTab) => renderToStaticMarkup(createElement(ProfileTabs, { active }));

describe("ProfileTabs (TASK-062 AC5)", () => {
  it("is a labelled navigation landmark with three links to the three pages", () => {
    const out = html("overview");
    expect(out).toContain('<nav aria-label="My Profile sections"');
    const tabs: [string, string][] = [
      ["/profile", "Overview"],
      ["/profile/organization", "Organization"],
      ["/profile/settings", "Account settings"],
    ];
    for (const [href, label] of tabs) {
      expect(out).toMatch(
        new RegExp(`<a[^>]*href="${href.replaceAll("/", "\\/")}"[^>]*>${label}</a>`),
      );
    }
    expect(out).not.toContain('role="tablist"');
  });

  it.each([
    ["overview", "/profile"],
    ["organization", "/profile/organization"],
    ["settings", "/profile/settings"],
  ] as const)("marks only %s as the current page", (active, href) => {
    const out = html(active);
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out).toMatch(
      new RegExp(
        `<a(?=[^>]*aria-current="page")(?=[^>]*href="${href.replaceAll("/", "\\/")}")[^>]*>`,
      ),
    );
  });

  it("makes each link at least 44px tall and keeps the strip inside the page", () => {
    const out = html("overview");
    expect(out.match(/min-h-11/g)).toHaveLength(3);
    expect(out).toContain("overflow-x-auto");
  });
});
