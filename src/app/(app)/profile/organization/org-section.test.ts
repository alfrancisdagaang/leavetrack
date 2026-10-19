import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as OrgModule from "@/lib/leave/org";
import type { EmployeeOrg, ManagerOrg, OrgNode, OrgPage, OrgTreeNode } from "@/lib/leave/org";

const reads = vi.hoisted(() => ({
  getEmployeeOrg: vi.fn(),
  getManagerOrg: vi.fn(),
  getOrgRoots: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => ({}) }));
vi.mock("@/lib/leave/org", async (importOriginal) => ({
  ...(await importOriginal<typeof OrgModule>()),
  ...reads,
}));

const { OrgSection } = await import("./org-section");

const node = (
  id: string,
  name: string,
  role: OrgNode["role"] = "employee",
  reports = 0,
): OrgNode => ({ id, name, role, reports });
const BOSS = node("boss", "Marco Santos", "manager", 3);
const ELENA = node("elena", "Elena Cruz");
const VIEWER_NAME = "Vera Viewer";
const VIEWER_EMAIL = "vera.viewer@leavetrack.example";
const render = async (role: "employee" | "manager" | "hr_admin", viewerId = "viewer") =>
  renderToStaticMarkup(
    await OrgSection({ role, viewer: { id: viewerId, name: VIEWER_NAME, email: VIEWER_EMAIL } }),
  );
/** The chart card only (after the summary at the top). */
const chartOf = (html: string) => html.slice(html.indexOf("<h2"));

beforeEach(() => {
  for (const fn of Object.values(reads)) fn.mockReset();
});

describe("OrgSection, employee (TASK-064 AC1)", () => {
  const org = (over: Partial<EmployeeOrg> = {}): EmployeeOrg => ({
    manager: BOSS,
    me: ELENA,
    reports: [],
    ...over,
  });

  it("shows the manager above, the person highlighted with 'You' and aria-current, and 'No direct reports'", async () => {
    reads.getEmployeeOrg.mockResolvedValue(org());
    const html = await render("employee");
    expect(html).toContain("Your place in the organization");
    const chart = chartOf(html);
    expect(chart.indexOf("Marco Santos")).toBeLessThan(chart.indexOf("Elena Cruz"));
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="true"[^>]*>.*Elena Cruz.*You/);
    expect(html).toContain("No direct reports");
    expect(html).toContain("Team members reporting to you will appear here.");
    expect(html).toContain("Reporting line");
    expect(html).toContain("Your manager");
  });

  it("lists the direct reports below, none of them highlighted", async () => {
    reads.getEmployeeOrg.mockResolvedValue(
      org({
        me: node("elena", "Elena Cruz", "manager", 2),
        reports: [node("j", "Jun Bautista"), node("k", "Kai Lim")],
      }),
    );
    const html = await render("employee");
    expect(html).toContain("Jun Bautista");
    expect(html).toContain("Kai Lim");
    expect(html).not.toContain("Team members reporting to you will appear here.");
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
  });

  it("says so at the top of the chart, with no manager card person", async () => {
    reads.getEmployeeOrg.mockResolvedValue(org({ manager: null }));
    const html = await render("employee");
    expect(html).toContain("No manager: you are at the top of the chart.");
    expect(html).toContain("You have no manager");
  });

  it("reads once, for the session user's id", async () => {
    reads.getEmployeeOrg.mockResolvedValue(org());
    await render("employee", "session-id");
    expect(reads.getEmployeeOrg).toHaveBeenCalledTimes(1);
    expect(reads.getEmployeeOrg.mock.calls[0]![1]).toBe("session-id");
    expect(reads.getManagerOrg).not.toHaveBeenCalled();
    expect(reads.getOrgRoots).not.toHaveBeenCalled();
  });
});

describe("OrgSection, manager (TASK-064 AC2)", () => {
  const p = (
    id: string,
    parentId: string,
    depth: number,
    reports = 0,
    name = id.toUpperCase(),
  ): OrgTreeNode => ({ id, name, role: "employee", reports, parentId, depth });
  const org = (people: OrgTreeNode[], over: Partial<ManagerOrg> = {}): ManagerOrg => ({
    manager: node("hana", "Hana Reyes", "hr_admin", 2),
    me: node("marco", "Marco Santos", "manager", 2),
    people,
    total: people.length,
    truncated: false,
    ...over,
  });

  it("shows the manager above, themselves highlighted and a tree whose people with reports are closed details", async () => {
    reads.getManagerOrg.mockResolvedValue(
      org([p("a", "marco", 1, 1, "Ann"), p("b", "marco", 1, 0, "Bo"), p("c", "a", 2, 0, "Cy")]),
    );
    const html = await render("manager", "marco");
    const chart = chartOf(html);
    expect(chart.indexOf("Hana Reyes")).toBeLessThan(chart.indexOf("Marco Santos"));
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toContain("People under you");
    expect(html.match(/<details/g)).toHaveLength(1); // only Ann has people under her
    expect(html).not.toMatch(/<details[^>]*\bopen\b/); // closed: only the first level shows at first
    expect(html).toMatch(/<summary[^>]*>.*Ann.*1 direct report/);
    expect(html).toContain("Cy"); // inside the closed details, still in the page for keyboard users
    expect(html).toContain("Bo");
  });

  it("indents levels 2 and 3 only, so a six-level tree stays inside the page (AC4)", async () => {
    const chain = [
      p("d1", "marco", 1, 1),
      p("d2", "d1", 2, 1),
      p("d3", "d2", 3, 1),
      p("d4", "d3", 4, 1),
      p("d5", "d4", 5, 1),
      p("d6", "d5", 6, 2),
    ];
    reads.getManagerOrg.mockResolvedValue(org(chain));
    const html = await render("manager", "marco");
    expect(html.match(/<details/g)).toHaveLength(5);
    expect(html.match(/ml-3 border-l border-line pl-3/g)).toHaveLength(2); // levels 2 and 3
    expect(html.match(/border-l border-line pl-0/g)).toHaveLength(3); // levels 4, 5 and 6
    expect(html).toContain("2 reports not shown"); // depth 6 has reports the read does not load
  });

  it("says how many exist when the list was cut, and notes a person's missing reports", async () => {
    reads.getManagerOrg.mockResolvedValue(
      org([p("a", "marco", 1, 3, "Ann"), p("c", "a", 2, 0, "Cy")], { total: 250, truncated: true }),
    );
    const html = await render("manager", "marco");
    expect(html).toContain("Showing 2 of 250 people under you.");
    expect(html).toContain("2 reports not shown"); // Ann has 3 reports, 1 loaded
  });

  it("has no note when nothing was cut, and says 'No direct reports' for an empty tree", async () => {
    reads.getManagerOrg.mockResolvedValue(org([]));
    const html = await render("manager", "marco");
    expect(html).not.toContain("Showing");
    expect(html).toContain("No direct reports");
    expect(html).not.toContain("<details");
  });

  it("reads once, for the session user's id", async () => {
    reads.getManagerOrg.mockResolvedValue(org([]));
    await render("manager", "session-id");
    expect(reads.getManagerOrg).toHaveBeenCalledTimes(1);
    expect(reads.getManagerOrg.mock.calls[0]![1]).toBe("session-id");
    expect(reads.getEmployeeOrg).not.toHaveBeenCalled();
  });
});

describe("OrgSection, HR admin (TASK-064 AC2)", () => {
  const roots = (people: OrgNode[], total = people.length): OrgPage => ({
    total,
    page: 1,
    pageSize: 50,
    people,
  });
  const SAM = node("sam", "Sam Okafor", "hr_admin", 1);
  const HANA = node("hana", "Hana Reyes", "hr_admin", 2);

  beforeEach(() => {
    reads.getEmployeeOrg.mockResolvedValue({ manager: SAM, me: HANA, reports: [] });
  });

  it("shows the top of the company, with a labelled, closed expand button for each person who has reports", async () => {
    reads.getOrgRoots.mockResolvedValue(roots([SAM, node("leaf", "Lone Wolf")]));
    const html = await render("hr_admin", "hana");
    expect(html).toContain("The company");
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(1); // only Sam has reports
    expect(html).toContain('aria-controls="org-panel-sam"');
    expect(html).toContain("Show 1 report of Sam Okafor");
    expect(html).not.toContain("<details");
  });

  it("marks the viewer 'You' when they are among the people shown", async () => {
    reads.getOrgRoots.mockResolvedValue(roots([HANA]));
    expect(await render("hr_admin", "hana")).toMatch(/aria-current="true"/);
    reads.getOrgRoots.mockResolvedValue(roots([SAM]));
    expect(await render("hr_admin", "hana")).not.toMatch(/aria-current="true"/);
  });

  it("shows HR's own manager in the side card, from the viewer's own read", async () => {
    reads.getOrgRoots.mockResolvedValue(roots([SAM]));
    const html = await render("hr_admin", "hana");
    expect(html).toContain("Your manager");
    expect(html.match(/Sam Okafor/g)!.length).toBeGreaterThanOrEqual(2);
    expect(reads.getEmployeeOrg.mock.calls[0]![1]).toBe("hana");
  });

  it("says how many exist when there are more people at the top than one page", async () => {
    reads.getOrgRoots.mockResolvedValue(roots([SAM], 61));
    expect(await render("hr_admin", "hana")).toContain(
      "Showing 1 of 61 people at the top of the company.",
    );
    reads.getOrgRoots.mockResolvedValue(roots([SAM]));
    expect(await render("hr_admin", "hana")).not.toContain("Showing");
  });

  it("keeps the chart when only HR's own manager cannot be read", async () => {
    reads.getOrgRoots.mockResolvedValue(roots([SAM]));
    reads.getEmployeeOrg.mockRejectedValue(new Error("boom"));
    const html = await render("hr_admin", "hana");
    expect(html).toContain("Sam Okafor");
    expect(html).toContain("Your manager could not be loaded right now.");
    expect(html).not.toContain('role="alert"');
  });

  it("reads the roots and the viewer's own neighbourhood once each, for the session id", async () => {
    reads.getOrgRoots.mockResolvedValue(roots([SAM]));
    await render("hr_admin", "session-id");
    expect(reads.getOrgRoots).toHaveBeenCalledTimes(1);
    expect(reads.getOrgRoots.mock.calls[0]![1]).toEqual({ viewerId: "session-id" });
    expect(reads.getEmployeeOrg).toHaveBeenCalledTimes(1);
    expect(reads.getManagerOrg).not.toHaveBeenCalled();
  });

  it("says so, with nobody listed, when nobody is at the top", async () => {
    reads.getOrgRoots.mockResolvedValue(roots([]));
    expect(await render("hr_admin", "hana")).toContain("Nobody is at the top of the chart yet.");
  });
});

describe("OrgSection, every role (TASK-064 AC3, AC5)", () => {
  it.each([
    ["employee", () => reads.getEmployeeOrg.mockRejectedValue(new Error("boom"))],
    ["manager", () => reads.getManagerOrg.mockRejectedValue(new Error("boom"))],
    ["hr_admin", () => reads.getOrgRoots.mockRejectedValue(new Error("boom"))],
  ] as const)(
    "a failed read for %s is an alert with a way to retry, and shows nobody",
    async (role, fail) => {
      fail();
      reads.getEmployeeOrg.mockRejectedValue(new Error("boom"));
      const html = await render(role);
      expect(html).toContain('role="alert"');
      expect(html).toContain("could not be loaded");
      expect(html).toContain('href="/profile/organization"');
      expect(html).not.toContain("Marco Santos");
      // The summary is the session user's own data, so it stays up above the alert.
      expect(html).toContain(VIEWER_NAME);
      expect(html).toContain(VIEWER_EMAIL);
    },
  );

  it("a viewer the database does not know is the same alert, not a crash", async () => {
    reads.getEmployeeOrg.mockResolvedValue(null);
    reads.getManagerOrg.mockResolvedValue(null);
    expect(await render("employee")).toContain('role="alert"');
    expect(await render("manager")).toContain('role="alert"');
  });

  it("links to nobody, shows no email, and writes the role as text, whatever the read returned", async () => {
    const leaky = {
      ...node("x", "Xia Wen", "manager", 1),
      email: "secret@leak.example",
      reason: "private",
    };
    reads.getEmployeeOrg.mockResolvedValue({ manager: leaky, me: ELENA, reports: [leaky] });
    reads.getManagerOrg.mockResolvedValue({
      manager: leaky,
      me: leaky,
      people: [{ ...leaky, parentId: "x", depth: 1 }],
      total: 1,
      truncated: false,
    });
    reads.getOrgRoots.mockResolvedValue({ total: 1, page: 1, pageSize: 50, people: [leaky] });
    for (const role of ["employee", "manager", "hr_admin"] as const) {
      const html = await render(role);
      expect(html, role).not.toMatch(/<a[\s>]/);
      // The only email on the page is the viewer's own, in the summary; the chart carries none.
      expect(html, role).not.toMatch(/secret@leak|private|mailto:/);
      expect(html.replaceAll(VIEWER_EMAIL, ""), role).not.toContain("@");
      expect(html, role).toContain("Manager ·");
    }
  });

  it("wraps a long unbroken name instead of widening the page (AC4)", async () => {
    const long = "W".repeat(140);
    reads.getEmployeeOrg.mockResolvedValue({
      manager: node("m", long, "manager", 1),
      me: node("e", long),
      reports: [],
    });
    const html = await render("employee");
    expect(html).toContain("[overflow-wrap:anywhere]");
    expect(html).toContain("min-w-0");
    expect(html).toContain(long);
  });

  it.each(["employee", "manager", "hr_admin"] as const)(
    "the %s chart's grid has a shrinkable column below lg: without it a grid item is as wide as its longest word and the page scrolls sideways (found in the browser)",
    async (role) => {
      reads.getEmployeeOrg.mockResolvedValue({ manager: BOSS, me: ELENA, reports: [] });
      reads.getManagerOrg.mockResolvedValue({
        manager: BOSS,
        me: BOSS,
        people: [],
        total: 0,
        truncated: false,
      });
      reads.getOrgRoots.mockResolvedValue({ total: 1, page: 1, pageSize: 50, people: [BOSS] });
      const html = await render(role);
      expect(html).toContain("grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]");
    },
  );
});

describe("OrgSection, the summary and the chart card (the redesign)", () => {
  const ORG: EmployeeOrg = { manager: BOSS, me: ELENA, reports: [] };
  const EMPTY_MANAGER: ManagerOrg = {
    manager: BOSS,
    me: BOSS,
    people: [],
    total: 0,
    truncated: false,
  };

  it("starts with the viewer's own summary: name, 'You', role in words, email and manager", async () => {
    reads.getEmployeeOrg.mockResolvedValue(ORG);
    const html = await render("employee");
    const summary = html.slice(0, html.indexOf("<h2"));
    expect(summary).toContain(VIEWER_NAME);
    expect(summary).toContain("You");
    expect(summary).toContain("Employee");
    expect(summary).toContain(VIEWER_EMAIL);
    expect(summary).toContain("Manager");
    expect(summary).toContain("Marco Santos");
    expect(summary).toContain("/icons/mail-dark.svg");
  });

  it("reads 'No manager' for someone at the top, and leaves the line out when HR's own manager could not be read", async () => {
    reads.getEmployeeOrg.mockResolvedValue({ ...ORG, manager: null });
    expect(await render("employee")).toContain("No manager</dd>");
    reads.getOrgRoots.mockResolvedValue({ total: 1, page: 1, pageSize: 50, people: [BOSS] });
    reads.getEmployeeOrg.mockRejectedValue(new Error("boom"));
    const html = await render("hr_admin");
    expect(html.slice(0, html.indexOf("<h2"))).not.toContain("Manager</dt>");
  });

  it("takes the email from the session, never from a read: a read that carries another email changes nothing", async () => {
    reads.getEmployeeOrg.mockResolvedValue({
      ...ORG,
      me: { ...ELENA, email: "someone.else@leak.example" } as unknown as OrgNode,
    });
    const html = await render("employee");
    expect(html).toContain(VIEWER_EMAIL);
    expect(html).not.toContain("someone.else@leak.example");
  });

  it("has the title and help line, the legend in a box, and 'Your manager' beside the chart", async () => {
    reads.getEmployeeOrg.mockResolvedValue(ORG);
    const html = await render("employee");
    expect(html).toContain("See who you report to and who reports to you.");
    expect(html).toMatch(/<p class="[^"]*border[^"]*"><span[^>]*><\/span>Reporting line/);
    expect(html).toMatch(/<aside[^>]*>.*Your manager/);
  });

  it("uses the wider column for the trees and the narrow one for an employee", async () => {
    reads.getEmployeeOrg.mockResolvedValue(ORG);
    expect(await render("employee")).toContain("max-w-md");
    reads.getManagerOrg.mockResolvedValue(EMPTY_MANAGER);
    expect(await render("manager")).toContain("max-w-2xl");
  });

  it("leaves out what the reference had and this app does not: job title, department, View profile, Appearance, dark mode", async () => {
    reads.getEmployeeOrg.mockResolvedValue(ORG);
    reads.getManagerOrg.mockResolvedValue(EMPTY_MANAGER);
    reads.getOrgRoots.mockResolvedValue({ total: 1, page: 1, pageSize: 50, people: [BOSS] });
    for (const role of ["employee", "manager", "hr_admin"] as const) {
      // Visible text only: icon file names such as mail-dark.svg are not on screen.
      const visible = (await render(role)).replace(/<[^>]*>/g, " ");
      expect(visible, role).not.toMatch(
        /Job title|Department|View profile|Appearance|Dark|Light|System/i,
      );
    }
  });
});
