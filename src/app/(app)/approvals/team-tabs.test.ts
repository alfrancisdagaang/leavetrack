import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TeamTabs } from "./team-tabs";

const render = (active: "approvals" | "team") =>
  renderToStaticMarkup(createElement(TeamTabs, { active }));

describe("TeamTabs", () => {
  it("is a labelled navigation landmark with links, not a tablist", () => {
    const out = render("approvals");
    expect(out).toMatch(/^<nav aria-label="Team approvals sections"/);
    expect(out).not.toContain("tablist");
  });

  it.each([
    ["approvals", "/approvals", "Approvals"],
    ["team", "/approvals/team", "My team"],
  ] as const)("marks only the %s tab as current", (active, href, label) => {
    const out = render(active);
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out).toMatch(
      new RegExp(
        `<a(?=[^>]*aria-current="page")(?=[^>]*href="${href.replace(/\//g, "\\/")}")[^>]*>${label}</a>`,
      ),
    );
  });

  it("lists Approvals first and My team second, with 44px targets and no hard-coded colours", () => {
    const out = render("team");
    expect(out.indexOf("Approvals<")).toBeLessThan(out.indexOf("My team<"));
    expect(out).toContain("min-h-11");
    expect(out).not.toMatch(/#[0-9a-f]{3,6}|rgb\(/i);
  });
});
