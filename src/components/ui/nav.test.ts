import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { currentNavItem, navItemsFor, pageTitleFor, workspaceLabel } from "@/components/ui/nav";
import { NAV_ICON } from "@/components/ui/nav-icons";

const keys = (role: Parameters<typeof navItemsFor>[0]) => navItemsFor(role).map((i) => i.key);

describe("navItemsFor", () => {
  it("shows employees the dashboard, request, balance and their profile", () => {
    expect(keys("employee")).toEqual(["dashboard", "request", "balance", "profile"]);
  });

  it("gives managers the dashboard, Team Approvals, My Team and their profile as separate items", () => {
    expect(keys("manager")).toEqual(["dashboard", "approvals", "team", "profile"]);
  });

  it("offers Request Leave and My Balance to employees only (EPIC-10 AC2)", () => {
    for (const role of ["manager", "hr_admin"] as const) {
      expect(keys(role)).not.toContain("request");
      expect(keys(role)).not.toContain("balance");
    }
  });

  it("does not show Team Approvals (or My Team) to an employee", () => {
    expect(keys("employee")).not.toContain("approvals");
    expect(keys("employee")).not.toContain("team");
    expect(keys("hr_admin")).not.toContain("team");
  });

  it("gives HR admins the dashboard, Balance Overrides, the company calendar and the audit log, and no Team Approvals (EPIC-10 AC2)", () => {
    expect(keys("hr_admin")).toEqual(["dashboard", "overrides", "calendar", "audit", "profile"]);
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
    expect(linked).toEqual(["dashboard", "overrides", "calendar", "audit", "profile"]);
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
      "My Profile",
    ]);
    expect(navItemsFor("manager").map((i) => i.label)).toEqual([
      "Dashboard",
      "Team Approvals",
      "My Team",
      "My Profile",
    ]);
    expect(navItemsFor("hr_admin").map((i) => i.label)).toEqual([
      "Dashboard",
      "Balance Overrides",
      "Calendar",
      "Audit History",
      "My Profile",
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
    expect(at("/approvals/team")).toBe("team");
    expect(at("/approvals/team/00000000-0000-4000-8000-000000000003")).toBe("team");
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
    for (const item of [
      ...navItemsFor("hr_admin"),
      ...navItemsFor("manager"),
      ...navItemsFor("employee"),
    ]) {
      const icon = NAV_ICON[item.key];
      expect(icon, `${item.key} has no icon`).toBeTruthy();
      expect(existsSync(`public${icon}`), `${icon} is missing`).toBe(true);
    }
    expect(NAV_ICON.audit).toBe("/icons/nav-history.svg");
    expect(NAV_ICON.calendar).toBe("/icons/nav-calendar.svg");
    expect(NAV_ICON.overrides).toBe("/icons/nav-override.svg");
    expect(NAV_ICON.team).toBe("/icons/nav-team.svg");
    expect(NAV_ICON.team).not.toBe(NAV_ICON.approvals);
    expect(NAV_ICON.profile).toBe("/icons/nav-profile.svg");
    expect(NAV_ICON.profile).not.toBe(NAV_ICON.team); // My Team is the single-person icon; Profile is a person in a circle
  });

  it("gives every role the My Profile item exactly once (EPIC-11)", () => {
    for (const role of ["employee", "manager", "hr_admin"] as const)
      expect(keys(role).filter((k) => k === "profile")).toHaveLength(1);
  });
});

describe("pageTitleFor (TASK-062)", () => {
  it("titles every My Profile page 'My Profile', for every role", () => {
    for (const role of ["employee", "manager", "hr_admin"] as const) {
      const items = navItemsFor(role);
      for (const path of ["/profile", "/profile/organization", "/profile/settings"])
        expect(pageTitleFor(items, path)).toBe("My Profile");
    }
  });

  it("highlights My Profile on every profile page, for every role, and it is the last item", () => {
    for (const role of ["employee", "manager", "hr_admin"] as const) {
      const items = navItemsFor(role);
      expect(items.at(-1)?.key).toBe("profile");
      for (const path of ["/profile", "/profile/organization", "/profile/settings"])
        expect(currentNavItem(items, path)?.key).toBe("profile");
    }
  });

  it("is not fooled by a path that merely starts with the same letters", () => {
    expect(pageTitleFor(navItemsFor("employee"), "/profiles")).toBe("LeaveTrack");
  });

  it("keeps the nav item's label elsewhere, and LeaveTrack for an unknown page", () => {
    expect(pageTitleFor(navItemsFor("manager"), "/approvals/team")).toBe("My Team");
    expect(pageTitleFor(navItemsFor("employee"), "/balance")).toBe("My Balance");
    expect(pageTitleFor(navItemsFor("employee"), "/nowhere")).toBe("LeaveTrack");
  });
});
