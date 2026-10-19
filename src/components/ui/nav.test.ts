import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { currentNavItem, navItemsFor, workspaceLabel } from "@/components/ui/nav";
import { NAV_ICON } from "@/components/ui/nav-icons";

const keys = (role: Parameters<typeof navItemsFor>[0]) => navItemsFor(role).map((i) => i.key);

describe("navItemsFor", () => {
  it("shows employees the dashboard, request and balance", () => {
    expect(keys("employee")).toEqual(["dashboard", "request", "balance"]);
  });

  it("adds one Team Approvals item for managers; My Team is a tab inside it, not a nav item", () => {
    expect(keys("manager")).toEqual(["dashboard", "request", "balance", "approvals"]);
  });

  it("does not show Team Approvals (or My Team) to an employee", () => {
    expect(keys("employee")).not.toContain("approvals");
    expect(keys("manager")).not.toContain("team");
    expect(keys("hr_admin")).not.toContain("team");
  });

  it("adds HR Overrides and the audit log for HR admins on top of the manager items", () => {
    expect(keys("hr_admin")).toEqual([
      "dashboard",
      "request",
      "balance",
      "approvals",
      "overrides",
      "audit",
    ]);
  });

  it("shows HR Overrides to HR admins only (TASK-039 AC3)", () => {
    expect(keys("employee")).not.toContain("overrides");
    expect(keys("manager")).not.toContain("overrides");
    expect(keys("hr_admin")).toContain("overrides");
  });

  it("only links pages that exist (flip `available` when each task ships)", () => {
    const linked = navItemsFor("hr_admin")
      .filter((i) => i.available)
      .map((i) => i.key);
    expect(linked).toEqual(["dashboard", "request", "balance", "approvals", "overrides", "audit"]);
  });

  it("gives every item a unique key and an absolute href", () => {
    const items = navItemsFor("hr_admin");
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
    for (const i of items) expect(i.href.startsWith("/")).toBe(true);
  });

  it("labels the items as in the design", () => {
    expect(navItemsFor("hr_admin").map((i) => i.label)).toEqual([
      "Dashboard",
      "Request Leave",
      "My Balance",
      "Team Approvals",
      "HR Overrides",
      "Audit History",
    ]);
  });

  it("picks the item with the longest matching href, so HR Overrides wins under /approvals", () => {
    const items = navItemsFor("hr_admin");
    const at = (path: string) => currentNavItem(items, path)?.key;
    expect(at("/approvals")).toBe("approvals");
    expect(at("/approvals/team")).toBe("approvals");
    expect(at("/approvals/team/00000000-0000-4000-8000-000000000003")).toBe("approvals");
    expect(at("/approvals/overrides")).toBe("overrides");
    expect(at("/approvals/overrides/anything")).toBe("overrides");
    // A sibling path that merely starts with the same letters is not under HR Overrides.
    expect(at("/approvals/overrides-not")).toBe("approvals");
    expect(at("/audit")).toBe("audit");
    expect(at("/nowhere")).toBeUndefined();
  });

  it("names the workspace per role", () => {
    expect(workspaceLabel("employee")).toBe("Employee workspace");
    expect(workspaceLabel("manager")).toBe("Manager workspace");
    expect(workspaceLabel("hr_admin")).toBe("HR Admin workspace");
  });

  it("gives every item an icon, and the icon file exists (Audit History included)", () => {
    for (const item of navItemsFor("hr_admin")) {
      const icon = NAV_ICON[item.key];
      expect(icon, `${item.key} has no icon`).toBeTruthy();
      expect(existsSync(`public${icon}`), `${icon} is missing`).toBe(true);
    }
    expect(NAV_ICON.audit).toBe("/icons/nav-history.svg");
    expect(NAV_ICON.overrides).toBe("/icons/nav-override.svg");
  });
});
