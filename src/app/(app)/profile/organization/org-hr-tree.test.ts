import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OrgNode } from "@/lib/leave/org";
import { OrgHrTree } from "./org-hr-tree";

const node = (id: string, name: string, reports = 0): OrgNode => ({
  id,
  name,
  role: "manager",
  reports,
});
const html = (roots: OrgNode[], viewerId = "me") =>
  renderToStaticMarkup(createElement(OrgHrTree, { roots, viewerId }));

describe("OrgHrTree, first render (TASK-064 AC2, AC5)", () => {
  const out = html([node("sam", "Sam Okafor", 2), node("lone", "Lone Wolf")]);

  it("lists the people it was given, closed, with a button only for those who have reports", () => {
    expect(out).toContain("Sam Okafor");
    expect(out).toContain("Lone Wolf");
    expect(out.match(/<button/g)).toHaveLength(1);
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('aria-controls="org-panel-sam"');
    expect(out).not.toContain('id="org-panel-sam"'); // nothing is loaded or shown until it is opened
  });

  it("names the button for assistive technology, and makes it at least 44px square", () => {
    expect(out).toContain('<span class="sr-only">Show 2 reports of Sam Okafor</span>');
    expect(out).toContain("min-h-11");
    expect(out).toContain("min-w-11");
  });

  it("can move focus to a person (so focus survives 'Show more'): each has an id and tabindex -1", () => {
    expect(out).toContain('id="org-person-sam"');
    expect(out.match(/tabindex="-1"/g)).toHaveLength(2);
  });

  it("marks the viewer, links to nobody and shows no email", () => {
    const mine = html([node("me", "Hana Reyes", 1)], "me");
    expect(mine).toContain('aria-current="true"');
    expect(out).not.toMatch(/<a[\s>]|@/);
  });
});

describe("OrgHrTree source guards (TASK-064)", () => {
  const src = readFileSync("src/app/(app)/profile/organization/org-hr-tree.tsx", "utf8");

  it("never defines a component inside the component: that remounts the tree on every render and drops focus from the button being used", () => {
    expect(src).not.toMatch(/function\s+(List|Row)\b/);
    expect(src).not.toMatch(/<(List|Row)[\s/>]/);
  });

  it("reads only through the HR route, uncached, and never by polling", () => {
    expect(src).toContain("/api/org/children?parent=");
    expect(src).toContain('cache: "no-store"');
    expect(src).not.toMatch(/setInterval|setTimeout/);
    expect(src).not.toMatch(/@\/lib\/db|@\/lib\/leave\/service|postgres/);
  });
});
