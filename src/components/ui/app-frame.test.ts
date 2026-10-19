import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { navItemsFor } from "@/components/ui/nav";

let path = "/approvals";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

const { AppFrame } = await import("@/components/ui/app-frame");
const { AccountMenu } = await import("@/components/ui/account-menu");

const signOut = async () => {};

function frame(role: Parameters<typeof navItemsFor>[0]) {
  return renderToStaticMarkup(
    createElement(
      AppFrame,
      {
        role,
        timeZone: "UTC",
        userName: "Marco Santos",
        email: "marco.santos@leavetrack.example",
        roleLabel: "Manager",
        workspace: "Manager workspace",
        items: navItemsFor(role),
        signOutAction: signOut,
      } as ComponentProps<typeof AppFrame>,
      createElement("p", null, "page body"),
    ),
  );
}

describe("AppFrame", () => {
  it("lists only the items the role may open, and nothing else", () => {
    const manager = frame("manager");
    for (const label of ["Dashboard", "Team Approvals"]) expect(manager).toContain(label);
    // EPIC-10: only employees request leave and see a balance.
    for (const label of ["Request Leave", "My Balance"]) {
      expect(manager).not.toContain(label);
      expect(frame("hr_admin")).not.toContain(label);
      expect(frame("employee")).toContain(label);
    }
    expect(manager).not.toContain("Audit History");
    expect(frame("employee")).not.toContain("Team Approvals");
    // EPIC-10: an HR admin has no team and no normal approvals.
    expect(frame("hr_admin")).not.toContain("Team Approvals");
    expect(manager).not.toContain("My Team");
    expect(frame("employee")).not.toContain("My Team");
    expect(frame("hr_admin")).toContain("Audit History");
    expect(manager).not.toContain("Balance Overrides");
    expect(frame("employee")).not.toContain("Balance Overrides");
    expect(frame("hr_admin")).toContain("Balance Overrides");
  });

  it("on /approvals/overrides only Balance Overrides is current, and it titles the top bar (not Team Approvals)", () => {
    path = "/approvals/overrides";
    const html = frame("hr_admin");
    path = "/approvals";
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(
      /<a(?=[^>]*aria-current="page")(?=[^>]*href="\/approvals\/overrides")[^>]*>/,
    );
    expect(html).toMatch(/<p class="[^"]*text-lg[^"]*">Balance Overrides<\/p>/);
  });

  it("for a manager, /approvals/team highlights Team Approvals", () => {
    path = "/approvals/team";
    const html = frame("manager");
    path = "/approvals";
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<a(?=[^>]*aria-current="page")(?=[^>]*href="\/approvals")[^>]*>/);
  });

  it("marks the current page and highlights it", () => {
    const html = frame("manager");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<a(?=[^>]*aria-current="page")(?=[^>]*href="\/approvals")[^>]*>/);
  });

  it.each([
    "/approvals",
    "/approvals/team",
    "/approvals/team/00000000-0000-4000-8000-000000000003",
  ])("keeps Team Approvals highlighted, and titles the top bar, on %s", (p) => {
    path = p;
    const html = frame("manager");
    path = "/approvals";
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<a(?=[^>]*aria-current="page")(?=[^>]*href="\/approvals")[^>]*>/);
    expect(html).toMatch(/<p class="[^"]*text-lg[^"]*">Team Approvals<\/p>/);
  });

  it("starts expanded with a labelled collapse control and a closed navigation drawer", () => {
    const html = frame("manager");
    expect(html).toContain("Collapse sidebar");
    expect(html).toMatch(
      /aria-controls="sidebar"[^>]*aria-expanded="true"|aria-expanded="true"[^>]*aria-controls="sidebar"/,
    );
    expect(html).toMatch(/aria-label="Open navigation"/);
    expect(html).not.toContain('role="dialog"');
  });

  it("shows the page title in the top bar and renders the page in the main landmark", () => {
    const html = frame("manager");
    expect(html).toMatch(/<p class="[^"]*text-lg[^"]*">Team Approvals<\/p>/);
    expect(html).toMatch(/<main id="main"[^>]*><p>page body<\/p><\/main>/);
  });
});

describe("AccountMenu", () => {
  const html = renderToStaticMarkup(
    createElement(AccountMenu, {
      name: "Marco Santos",
      roleLabel: "Manager",
      email: "marco.santos@leavetrack.example",
      signOutAction: signOut,
    }),
  );

  it("is a closed disclosure: the email and Sign out only appear once it is opened", () => {
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="account-panel"');
    expect(html).not.toContain("marco.santos@leavetrack.example");
    expect(html).not.toContain("Sign out");
  });

  it("names the account on the trigger for screen readers", () => {
    expect(html).toContain('aria-label="Account menu for Marco Santos"');
  });
});

describe("AppFrame notification bell (TASK-055)", () => {
  it("shows the bell in the top bar for every role, once, before the account menu", () => {
    for (const role of ["employee", "manager", "hr_admin"] as const) {
      const html = frame(role);
      expect(html.match(/aria-controls="notification-panel"/g)).toHaveLength(1);
      expect(html.indexOf('aria-label="Notifications"')).toBeGreaterThan(-1);
      expect(html.indexOf('aria-label="Notifications"')).toBeLessThan(
        html.indexOf("Account menu for"),
      );
      // The bell is not a nav item.
      expect(html).not.toContain('aria-current="page">Notifications');
    }
  });
});
