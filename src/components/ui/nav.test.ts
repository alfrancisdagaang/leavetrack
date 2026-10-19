import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { currentNavItem, navItemsFor, workspaceLabel } from "@/components/ui/nav";
import { NAV_ICON } from "@/components/ui/nav-icons";

const keys = (role: Parameters<typeof navItemsFor>[0]) => navItemsFor(role).map((i) => i.key);

describe("navItemsFor", () => {
  it("shows employees the dashboard, request and balance", () => {
    expect(keys("employee")).toEqual(["dashboard", "request", "balance"]);
  });

  it("gives managers the dashboard and one Team Approvals item; My Team is a tab inside it", () => {
    expect(keys("manager")).toEqual(["dashboard", "approvals"]);
  });

  it("offers Request Leave and My Balance to employees only (EPIC-10 AC2)", () => {
    for (const role of ["manager", "hr_admin"] as const) {
      expect(keys(role)).not.toContain("request");
      expect(keys(role)).not.toContain("balance");
    }
  });

  it("does not show Team Approvals (or My Team) to an employee", () => {
    expect(keys("employee")).not.toContain("approvals");
    expect(keys("manager")).not.toContain("team");
    expect(keys("hr_admin")).not.toContain("team");
  });

  it("gives HR admins the dashboard, Balance Overrides, the company calendar and the audit log, and no Team Approvals (EPIC-10 AC2)", () => {
    expect(keys("hr_admin")).toEqual(["dashboard", "overrides", "calendar", "audit"]);
    expect(keys("hr_admin")).not.toContain("approvals");
  });

  it("shows the company Calendar to HR admins only (EPIC-7 TASK-043 AC3)", () => {
    expect(keys("employee")).not.toContain("calendar");
    expect(keys("manager")).not.toContain("calendar");
    expect(keys("hr_admin")).toContain("calendar");
  });

  it("shows Balance Overrides to HR admins only (TASK-039 AC3)", () => {
    expect(keys("employee")).not.toContain("overrides");
    expect(keys("manager")).not.toContain("overrides");
    expect(keys("hr_admin")).toContain("overrides");
  });

  it("only links pages that exist (flip `available` when each task ships)", () => {
    const linked = navItemsFor("hr_admin")
      .filter((i) => i.available)
      .map((i) => i.key);
    expect(linked).toEqual(["dashboard", "overrides", "calendar", "audit"]);
  });

  it("gives every item a unique key and an absolute href", () => {
    const items = navItemsFor("hr_admin");
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
    for (const i of items) expect(i.href.startsWith("/")).toBe(true);
  });

  it("labels the items as in the design", () => {
    expect(navItemsFor("employee").map((i) => i.label)).toEqual([
      "Dashboard",
      "Request Leave",
      "My Balance",
    ]);
    expect(navItemsFor("manager").map((i) => i.label)).toEqual(["Dashboard", "Team Approvals"]);
    expect(navItemsFor("hr_admin").map((i) => i.label)).toEqual([
      "Dashboard",
      "Balance Overrides",
      "Calendar",
      "Audit History",
    ]);
  });

  it("picks the item with the longest matching href, so Balance Overrides wins under /approvals", () => {
    // No single role has both items now, so test the rule on the union of the two lists.
    const items = [
      ...navItemsFor("manager"),
      ...navItemsFor("hr_admin").filter((i) => i.key !== "dashboard"),
    ];
    const at = (path: string) => currentNavItem(items, path)?.key;
    expect(at("/approvals")).toBe("approvals");
    expect(at("/approvals/team")).toBe("approvals");
    expect(at("/approvals/team/00000000-0000-4000-8000-000000000003")).toBe("approvals");
    expect(at("/approvals/overrides")).toBe("overrides");
    expect(at("/approvals/overrides/anything")).toBe("overrides");
    // A sibling path that merely starts with the same letters is not under Balance Overrides.
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
    expect(NAV_ICON.calendar).toBe("/icons/nav-calendar.svg");
    expect(NAV_ICON.overrides).toBe("/icons/nav-override.svg");
  });
});
