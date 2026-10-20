import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewTabs } from "./view-tabs";

const tabs = [
  { key: "pending", label: "Pending", href: "/approvals" },
  { key: "decided", label: "Decided", href: "/approvals?view=decided" },
];
const render = (active: string) =>
  renderToStaticMarkup(createElement(ViewTabs, { tabs, active, label: "Team approvals views" }));

describe("ViewTabs", () => {
  it("is a navigation landmark with links, not a tablist", () => {
    const html = render("pending");
    expect(html).toMatch(/<nav[^>]*aria-label="Team approvals views"/);
    expect(html).not.toContain("tablist");
    expect(html).toContain('href="/approvals"');
    expect(html).toContain('href="/approvals?view=decided"');
  });

  it("marks exactly the open view as current", () => {
    for (const [active, label] of [
      ["pending", "Pending"],
      ["decided", "Decided"],
    ]) {
      const html = render(active!);
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
      expect(html).toMatch(new RegExp(`aria-current="page"[^>]*>${label}</a>`));
    }
  });

  it("has 44px targets and scrolls inside itself", () => {
    const html = render("pending");
    expect(html).toContain("min-h-11");
    expect(html).toContain("overflow-x-auto");
  });
});
