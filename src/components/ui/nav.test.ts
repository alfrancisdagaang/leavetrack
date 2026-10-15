import { describe, expect, it } from "vitest";
import { navItemsFor, workspaceLabel } from "@/components/ui/nav";

const keys = (role: Parameters<typeof navItemsFor>[0]) => navItemsFor(role).map((i) => i.key);

describe("navItemsFor", () => {
  it("shows employees the dashboard, request and balance", () => {
    expect(keys("employee")).toEqual(["dashboard", "request", "balance"]);
  });

  it("adds team approvals for managers", () => {
    expect(keys("manager")).toEqual(["dashboard", "request", "balance", "approvals"]);
  });

  it("adds the audit log for HR admins on top of the manager items", () => {
    expect(keys("hr_admin")).toEqual(["dashboard", "request", "balance", "approvals", "audit"]);
  });

  it("only links pages that exist (flip `available` when each task ships)", () => {
    const linked = navItemsFor("hr_admin")
      .filter((i) => i.available)
      .map((i) => i.key);
    expect(linked).toEqual(["dashboard", "request", "balance", "approvals", "audit"]);
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
      "Audit History",
    ]);
  });

  it("names the workspace per role", () => {
    expect(workspaceLabel("employee")).toBe("Employee workspace");
    expect(workspaceLabel("manager")).toBe("Manager workspace");
    expect(workspaceLabel("hr_admin")).toBe("HR Admin workspace");
  });
});
