import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { TeamMemberQuery } from "@/lib/leave/schemas";
import { MemberBalances } from "./member-balances";
import { FilterShell } from "./member-filter-shell";
import { MemberFilters } from "./member-filters";
import { MemberHeader } from "./member-header";
import { MemberPagination } from "./member-pagination";
import { MemberError, NoMatches, PageOutOfRange } from "./member-states";
import TeamMemberNotFound from "./not-found";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const ID = "00000000-0000-4000-8000-000000000003";
const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const NO_COLOUR = /#[0-9a-fA-F]{3,6}\b|rgb\(|hsl\(|style="(?!color:transparent")/;

const QUERY: TeamMemberQuery = { leaveTypeId: undefined, status: undefined, year: 2026, page: 1 };
const TYPES = [
  { id: VAC, name: "Vacation" },
  { id: SICK, name: "Sick" },
];

describe("MemberHeader (US-13 AC1)", () => {
  const out = renderToStaticMarkup(
    MemberHeader({ member: { id: ID, name: "Elena Cruz", role: "employee" } }),
  );

  it("links back to My Team and shows the person as the page's h1 with their role", () => {
    expect(out).toMatch(/<a [^>]*href="\/approvals\/team"[^>]*>[\s\S]*Back to My team<\/a>/);
    expect(out).toMatch(/<h1[^>]*>Elena Cruz<\/h1>/);
    expect(out).toContain("Employee");
    expect(out).toContain(">EC<");
  });

  it("labels a manager and an HR admin by their role", () => {
    const manager = renderToStaticMarkup(
      MemberHeader({ member: { id: ID, name: "Marco Santos", role: "manager" } }),
    );
    expect(manager).toContain("Manager");
  });
});

describe("MemberBalances (US-13 AC1)", () => {
  const balances = [
    {
      leaveTypeId: VAC,
      leaveTypeName: "Vacation",
      tracksBalance: true,
      confirmed: 10,
      pending: 2,
      available: 8,
    },
    {
      leaveTypeId: SICK,
      leaveTypeName: "Sick",
      tracksBalance: true,
      confirmed: 7,
      pending: 2,
      available: 5,
    },
  ];
  const out = renderToStaticMarkup(MemberBalances({ balances }));

  it("shows what is available after pending, with confirmed and pending, per tracked type", () => {
    expect(out).toContain("8 days");
    expect(out).toContain("Confirmed 10 · Pending 2");
    expect(out).toContain("5 days");
    expect(out).toContain("Confirmed 7 · Pending 2");
    expect(out.match(/Available after pending/g)).toHaveLength(2);
  });

  it("has an icon tile per type and no chevron (there is nowhere to go)", () => {
    expect(out).toContain("sun.svg");
    expect(out).toContain("heart-pulse.svg");
    expect(out).not.toContain("chevron");
  });

  it("renders nothing when there are no tracked types", () => {
    expect(renderToStaticMarkup(MemberBalances({ balances: [] }))).toBe("");
  });
});

describe("MemberFilters (US-13 AC2)", () => {
  const render = (query: TeamMemberQuery = QUERY) =>
    renderToStaticMarkup(
      createElement(
        FilterShell,
        null,
        createElement(MemberFilters, { memberId: ID, query, leaveTypes: TYPES, currentYear: 2026 }),
      ),
    );
  /** The chosen option of each select, independent of React's attribute order. */
  const chosen = (markup: string) =>
    Object.fromEntries(
      [...markup.matchAll(/<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)].map((m) => [
        m[1],
        /<option[^>]*selected=""[^>]*>/.exec(m[2] ?? "")?.[0].match(/value="([^"]*)"/)?.[1],
      ]),
    );

  it("is a card titled Filters holding a GET form, so it also works without JavaScript", () => {
    const out = render();
    expect(out).toMatch(/<h2 id="member-filters-heading"[^>]*>Filters<\/h2>/);
    expect(out).toContain('aria-labelledby="member-filters-heading"');
    expect(out).toContain('method="get"');
    expect(out).toContain(`action="/approvals/team/${ID}"`);
    expect(out).toContain('aria-label="Filter requests"');
  });

  it("has three labelled selects: leave type, status and year", () => {
    const out = render();
    for (const [id, label] of [
      ["member-filter-type", "Leave type"],
      ["member-filter-status", "Status"],
      ["member-filter-year", "Year"],
    ]) {
      expect(out).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>${label}</label>`));
      expect(out).toMatch(new RegExp(`<select[^>]*id="${id}"`));
    }
    expect(out.match(/<select/g)).toHaveLength(3);
  });

  it("lists All plus each leave type, All plus the three statuses, and this year and the two before it", () => {
    const out = render();
    for (const option of [
      "All leave types",
      "Vacation",
      "Sick",
      "All statuses",
      "Pending",
      "Approved",
      "Rejected",
    ]) {
      expect(out).toContain(`>${option}</option>`);
    }
    for (const year of ["2026", "2025", "2024"]) expect(out).toContain(`>${year}</option>`);
    expect(out).not.toContain(">2023</option>");
  });

  it("shows the applied choices selected, and All when nothing is applied", () => {
    expect(chosen(render())).toEqual({ type: "", status: "", year: "2026" });
    expect(chosen(render({ leaveTypeId: SICK, status: "pending", year: 2025, page: 2 }))).toEqual({
      type: SICK,
      status: "pending",
      year: "2025",
    });
  });

  it("has the design's icons (calendar, clock, calendar) and a chevron per select, all decorative", () => {
    const out = render();
    expect(out.match(/calendar-days\.svg/g)).toHaveLength(2);
    expect(out.match(/clock\.svg/g)).toHaveLength(1);
    expect(out.match(/chevron-down\.svg/g)).toHaveLength(3);
    expect(out.match(/<img alt=""/g)?.length).toBe(6);
  });

  it("has an Apply filters submit button and a Clear filters link back to the plain page", () => {
    const out = render();
    expect(out).toMatch(/<button[^>]*type="submit"[^>]*>Apply filters<\/button>/);
    expect(out).toMatch(new RegExp(`<a [^>]*href="/approvals/team/${ID}"[^>]*>Clear filters</a>`));
  });

  it("shows no applied-filter chips while everything is at its default", () => {
    const out = render();
    expect(out).not.toContain("Applied filters");
    expect(out).not.toContain("Clear all");
  });

  it("shows a chip per applied filter, each with a link that removes just that filter, and Clear all", () => {
    const out = render({ leaveTypeId: SICK, status: "pending", year: 2026, page: 1 });
    expect(out).toContain('aria-label="Applied filters"');
    expect(out).toContain("Leave type: Sick");
    expect(out).toContain("Status: Pending");
    expect(out).not.toContain("Year:");
    expect(out).toContain('aria-label="Remove filter Leave type: Sick"');
    expect(out).toContain('aria-label="Remove filter Status: Pending"');
    // Removing the leave type keeps the status; removing the status keeps the leave type.
    expect(out).toMatch(
      new RegExp(
        `<a [^>]*href="/approvals/team/${ID}\\?status=pending"[^>]*aria-label="Remove filter Leave type: Sick"`,
      ),
    );
    expect(out).toMatch(
      new RegExp(
        `<a [^>]*href="/approvals/team/${ID}\\?type=${SICK}"[^>]*aria-label="Remove filter Status: Pending"`,
      ),
    );
    expect(out).toMatch(new RegExp(`<a [^>]*href="/approvals/team/${ID}"[^>]*>Clear all</a>`));
  });

  it("shows a year chip only when the year is not the current one", () => {
    expect(render({ ...QUERY, year: 2025 })).toContain("Year: 2025");
    expect(render({ ...QUERY, year: 2026 })).not.toContain("Year:");
  });

  it("keeps every control at least 44px tall and shows keyboard focus", () => {
    const out = render({ leaveTypeId: SICK, status: "pending", year: 2025, page: 1 });
    expect(out).toContain("min-h-11");
    expect(out).toContain("focus-visible:outline-2");
  });

  it("uses tokens only", () => {
    expect(render({ leaveTypeId: SICK, status: "pending", year: 2025, page: 1 })).not.toMatch(
      NO_COLOUR,
    );
  });
});

describe("MemberPagination (US-13 AC6)", () => {
  const hrefFor = (p: number) => `/approvals/team/${ID}?page=${p}`;
  const render = (page: number, total: number) =>
    renderToStaticMarkup(MemberPagination({ page, total, hrefFor }) ?? null);

  it("renders nothing when everything fits on one page", () => {
    expect(render(1, 25)).toBe("");
    expect(render(1, 0)).toBe("");
  });

  it("page 1: Previous is disabled, Next links to page 2, and the range is written", () => {
    const out = render(1, 31);
    expect(out).toContain("Showing 1 to 25 of 31");
    expect(out).toMatch(/<span aria-disabled="true"[^>]*>Previous<\/span>/);
    expect(out).toMatch(new RegExp(`<a [^>]*href="/approvals/team/${ID}\\?page=2"[^>]*>Next</a>`));
  });

  it("the last page: Next is disabled, Previous links back, and the range ends at the total", () => {
    const out = render(2, 31);
    expect(out).toContain("Showing 26 to 31 of 31");
    expect(out).toMatch(/<span aria-disabled="true"[^>]*>Next<\/span>/);
    expect(out).toMatch(
      new RegExp(`<a [^>]*href="/approvals/team/${ID}\\?page=1"[^>]*>Previous</a>`),
    );
  });

  it("is a labelled navigation", () => {
    expect(render(1, 31)).toContain('<nav aria-label="Pagination"');
  });
});

describe("member states", () => {
  it("MemberError (AC8): announces the problem with the link outside the alert", () => {
    const out = renderToStaticMarkup(MemberError({ retryHref: `/approvals/team/${ID}?page=2` }));
    expect(out).toContain('role="alert"');
    expect(out).toContain("could not be loaded right now.");
    expect(out).toContain("Try again in a moment.");
    expect(out).toMatch(
      new RegExp(`<a [^>]*href="/approvals/team/${ID}\\?page=2"[^>]*>Try again</a>`),
    );
    const alert = out.slice(
      out.indexOf('role="alert"'),
      out.indexOf("</div>", out.indexOf('role="alert"')),
    );
    expect(alert).not.toContain("<a ");
  });

  it("NoMatches: says nothing matches and links to the plain page", () => {
    const out = renderToStaticMarkup(NoMatches({ clearHref: `/approvals/team/${ID}` }));
    expect(out).toContain("No requests match these filters.");
    expect(out).toMatch(new RegExp(`<a [^>]*href="/approvals/team/${ID}"[^>]*>Clear filters</a>`));
  });

  it("PageOutOfRange: says so and links to the first page", () => {
    const out = renderToStaticMarkup(PageOutOfRange({ firstPageHref: `/approvals/team/${ID}` }));
    expect(out).toContain("There are no requests on this page.");
    expect(out).toContain("Go to the first page");
  });

  it("the not found card says nothing that tells the reasons apart (AC7) and links back", () => {
    const out = renderToStaticMarkup(TeamMemberNotFound());
    expect(out).toContain("We couldn&#x27;t find that person on your team.");
    expect(out).toMatch(/<a [^>]*href="\/approvals\/team"[^>]*>Back to My team<\/a>/);
    for (const leak of ["another team", "does not exist", "deleted", "not allowed", "403", "404"]) {
      expect(out).not.toContain(leak);
    }
  });

  it("use tokens only", () => {
    const all = [
      renderToStaticMarkup(MemberError({ retryHref: "/approvals/team/x" })),
      renderToStaticMarkup(NoMatches({ clearHref: "/approvals/team/x" })),
      renderToStaticMarkup(PageOutOfRange({ firstPageHref: "/approvals/team/x" })),
      renderToStaticMarkup(TeamMemberNotFound()),
    ].join("");
    expect(all).not.toMatch(NO_COLOUR);
  });
});
