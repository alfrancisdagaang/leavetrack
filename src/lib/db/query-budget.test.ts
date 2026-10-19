import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Sql } from "postgres";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POOL_MAX } from "@/lib/db/client";
import type * as ServiceModule from "@/lib/leave/service";

/**
 * Pool budget guard. A page's reads run in parallel, each on its own pooled connection. A stalled
 * read keeps its connection while timedRead's retry takes another, so a page that needs the whole
 * pool has nothing spare and one stall cascades into every page stalling (2026-10-18 retro: 6
 * parallel reads against a pool of 5 hung; 4 and 5 did not). Every page must therefore stay at
 * POOL_MAX - 1 or fewer parallel statements. This runs each page's real data sections against a
 * fake client that records how many statements are in flight at once.
 */
const BUDGET = POOL_MAX - 1;

const holder = vi.hoisted(() => ({ sql: undefined as unknown }));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {}, refresh: () => {} }),
  unstable_rethrow: () => {},
  redirect: () => {},
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ APP_TIMEZONE: "UTC" }) }));
vi.mock("@/lib/auth/guards", () => ({
  requireRole: async () => ({ role: "manager", user: { id: "m1", name: "Marco" } }),
}));
vi.mock("@/lib/leave/service", async (importOriginal) => ({
  ...(await importOriginal<typeof ServiceModule>()),
  requireDb: () => holder.sql,
}));

/**
 * Answers every statement with no rows, except the balance summary and a team member's page, which
 * are a single row each (a person who was found, with nothing in the year).
 */
function trackingSql() {
  let inFlight = 0;
  let peak = 0;
  const sql = (strings: TemplateStringsArray) => {
    const text = strings.join("?");
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    const rows = /with me as/.test(text)
      ? [
          {
            manager: null,
            me: { id: "u1", name: "Elena", role: "employee", reports: 0 },
            reports: [],
          },
        ]
      : /with recursive viewer/.test(text)
        ? [
            {
              manager: null,
              me: { id: "u1", name: "Marco", role: "manager", reports: 0 },
              total: 0,
              people: [],
            },
          ]
        : /u\.manager_id is null/.test(text)
          ? [{ total: 0, people: [] }]
          : /with f as/.test(text)
            ? [{ total: 0, approved: 0, rejected: 0, pending: 0, deleted: 0, rows: [] }]
            : /as "leaveTypes"/.test(text)
              ? [{ leaveTypes: [], deciders: [], employeeNames: [] }]
              : /with member as/.test(text)
                ? [
                    {
                      member: { id: "x", name: "Elena Cruz", role: "employee" },
                      types: [],
                      balances: [],
                      pending: [],
                      total: 0,
                      requests: [],
                    },
                  ]
                : /from public\.users u\s+where u\.manager_id/.test(text)
                  ? []
                  : /json_agg\(/.test(text)
                    ? [{ types: [], balances: [], pending: [], pending_approvals: 0 }]
                    : [];
    return new Promise<unknown[]>((resolve) =>
      setTimeout(() => {
        inFlight -= 1;
        resolve(rows);
      }, 5),
    );
  };
  return { sql: sql as unknown as Sql, peak: () => peak };
}

const { CalendarSection, SummarySection, UpcomingSection, ActivitySection } =
  await import("@/app/(app)/dashboard/sections");
const { RequestFormSection } = await import("@/app/(app)/requests/new/request-form-section");
const { BalanceSection } = await import("@/app/(app)/balance/balance-section");
const { PendingSection, DecidedSection } = await import("@/app/(app)/approvals/approvals-sections");
const { AuditBody } = await import("@/app/(app)/audit/audit-body");
const { OverrideQueueSection, RecentOverridesSection } =
  await import("@/app/(app)/approvals/overrides/override-sections");
const { RosterSection } = await import("@/app/(app)/approvals/team/roster-section");
const { MemberPopup } = await import("@/app/(app)/approvals/team/member-popup");
const { OverviewSection } = await import("@/app/(app)/profile/overview-section");
const { OrgSection } = await import("@/app/(app)/profile/organization/org-section");
const { CalendarBody } = await import("@/app/(app)/calendar/calendar-body");
const { default: TeamMemberRoute } = await import("@/app/(app)/approvals/team/[userId]/page");

let tracker: ReturnType<typeof trackingSql>;
beforeEach(() => {
  tracker = trackingSql();
  holder.sql = tracker.sql;
});

const dashboard = (role: "employee" | "manager" | "hr_admin") =>
  Promise.all([
    SummarySection({ role, userId: "u1", today: "2026-10-18" }),
    // EPIC-7: the HR dashboard has no calendar (the Company Calendar page replaces it).
    role === "hr_admin"
      ? null
      : CalendarSection({
          role,
          viewerId: "u1",
          month: { year: 2026, month: 10 },
          today: "2026-10-18",
          showRejected: false,
        }),
    UpcomingSection({ role, viewerId: "u1", today: "2026-10-18" }),
    ActivitySection({ role, viewerId: "u1", timeZone: "Asia/Manila" }),
  ]);

describe("query budget (parallel statements per page)", () => {
  it("the guard can fail: six parallel statements read as six", async () => {
    const sql = tracker.sql as unknown as (s: TemplateStringsArray) => Promise<unknown>;
    await Promise.all(Array.from({ length: 6 }, () => sql`select 1` as Promise<unknown>));
    expect(tracker.peak()).toBe(6);
    expect(tracker.peak()).toBeGreaterThan(BUDGET);
  });

  for (const role of ["employee", "manager", "hr_admin"] as const) {
    it(`dashboard (${role}) stays within ${BUDGET} parallel statements`, async () => {
      await dashboard(role);
      expect(tracker.peak()).toBeGreaterThan(0);
      expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
    });
  }

  it("the HR dashboard is exactly four statements: override count, who is out, upcoming, activity (no calendar)", async () => {
    await dashboard("hr_admin");
    expect(tracker.peak()).toBe(4);
  });

  it("a manager's dashboard keeps its four: ONE summary read (approvals and who is out), calendar, upcoming, activity", async () => {
    await dashboard("manager");
    expect(tracker.peak()).toBe(4);
  });

  it("Request Leave stays within the budget", async () => {
    await RequestFormSection({ userId: "u1" });
    expect(tracker.peak()).toBeGreaterThan(0);
    expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
  });

  it("My Balance stays within the budget", async () => {
    await BalanceSection({ userId: "u1", today: "2026-10-18" });
    expect(tracker.peak()).toBeGreaterThan(0);
    expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
    // Request list + breakdown + last accrual: the breakdown must stay folded into one statement.
    expect(tracker.peak()).toBeLessThanOrEqual(3);
  });

  it("Team approvals stays within the budget", async () => {
    await Promise.all([PendingSection({ managerId: "m1" }), DecidedSection({ managerId: "m1" })]);
    expect(tracker.peak()).toBeGreaterThan(0);
    expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
  });

  it("HR overrides reads the queue and the recent overrides: two statements", async () => {
    await Promise.all([
      OverrideQueueSection({ hrId: "h1" }),
      RecentOverridesSection({ now: new Date("2026-10-19T09:00:00Z"), timeZone: "UTC" }),
    ]);
    expect(tracker.peak()).toBe(2);
    expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
  });

  it.each([
    ["employee", 1],
    ["manager", 1],
    ["hr_admin", 2],
  ] as const)(
    "the Organization tab for %s reads %i statement(s), within the budget (TASK-064)",
    async (role, statements) => {
      await OrgSection({
        role,
        viewer: { id: "u1", name: "Elena Cruz", email: "elena.cruz@leavetrack.example" },
      });
      expect(tracker.peak()).toBe(statements);
      expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
    },
  );

  it("My Profile Overview reads the person and their manager in ONE statement (TASK-062 AC3)", async () => {
    await OverviewSection({ userId: "u1" });
    expect(tracker.peak()).toBe(1);
    expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
  });

  it("My Team (the roster) reads everything in ONE statement, however many people report to the manager", async () => {
    await RosterSection({ managerId: "m1", today: "2026-10-18" });
    expect(tracker.peak()).toBe(1);
    expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
  });

  it("My Team with a member open reads the roster and the person: two statements", async () => {
    await Promise.all([
      RosterSection({ managerId: "m1", today: "2026-10-18" }),
      MemberPopup({
        managerId: "m1",
        memberParam: "00000000-0000-4000-8000-000000000003",
        searchParams: {},
        today: "2026-10-18",
      }),
    ]);
    expect(tracker.peak()).toBe(2);
    expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
  });

  it("A team member's page reads the person, balances, filters and requests in ONE statement", async () => {
    await TeamMemberRoute({
      params: Promise.resolve({ userId: "00000000-0000-4000-8000-000000000003" }),
      searchParams: Promise.resolve({}),
    });
    expect(tracker.peak()).toBe(1);
    expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
  });

  it("The HR calendar reads the choices, the month and a day: three statements at most (EPIC-7 TASK-043)", async () => {
    await CalendarBody({
      viewerId: "h1",
      query: {
        month: undefined,
        managerId: undefined,
        leaveTypeId: undefined,
        day: "2026-10-14",
        q: undefined,
        page: 1,
      },
      today: "2026-10-18",
    });
    expect(tracker.peak()).toBe(3);
    expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
    // Without a day open, the day read is not made at all.
    tracker = trackingSql();
    holder.sql = tracker.sql;
    await CalendarBody({
      viewerId: "h1",
      query: {
        month: undefined,
        managerId: undefined,
        leaveTypeId: undefined,
        day: undefined,
        q: undefined,
        page: 1,
      },
      today: "2026-10-18",
    });
    expect(tracker.peak()).toBe(2);
  });

  it("The audit list reads the filter choices and one page of requests: two statements", async () => {
    await AuditBody({
      query: {
        q: undefined,
        leaveTypeId: undefined,
        status: undefined,
        decidedBy: undefined,
        from: undefined,
        to: undefined,
        page: 1,
      },
    });
    expect(tracker.peak()).toBe(2);
    expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
  });
});

/**
 * TASK-055. The notification bell runs on EVERY signed-in page, and the three dashboards already
 * use the whole budget (4 of POOL_MAX - 1). A statement in the layout would add a fifth, the
 * number that stalled pages in October. So the bell reads in the BROWSER (the TASK-054 routes),
 * after the page has loaded, and the layout and the chrome run no database statement for it. This
 * guard fails if anyone moves that read onto the server render path.
 */
describe("the layout and the bell add no statement to a page (TASK-055)", () => {
  const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
  const CHROME = [
    "src/app/(app)/layout.tsx",
    "src/components/ui/app-shell.tsx",
    "src/components/ui/app-frame.tsx",
    "src/components/ui/notification-bell.tsx",
    "src/components/ui/notification-panel.tsx",
    "src/components/ui/notification-state.ts",
    "src/components/ui/notification-text.ts",
  ];

  it.each(CHROME)("%s imports nothing that reaches the database", (file) => {
    const source = read(file);
    // A value import of the db client, the service or the notifications module (type imports are
    // erased, and `db/types` is constants only).
    const reaching = source
      .split("\n")
      .filter((line) => /^import (?!type\b)/.test(line))
      .filter((line) => /@\/lib\/(db\/(client|timed)|leave\/(notifications|service))/.test(line));
    expect(reaching).toEqual([]);
    expect(source).not.toMatch(
      /\b(getDb|requireDb|timedRead|listNotifications|markNotificationsRead)\b/,
    );
  });

  it("the bell is the only client piece, and it reads through the two API routes", () => {
    const bell = read("src/components/ui/notification-bell.tsx");
    expect(bell.startsWith('"use client";')).toBe(true);
    expect(bell).toContain('"/api/notifications"');
    expect(bell).toContain('"/api/notifications/read"');
  });

  it("never reads on navigation: no effect depends on the pathname", () => {
    const bell = read("src/components/ui/notification-bell.tsx");
    // The pathname only keys whether the panel is open; it is not a dependency of a read.
    expect(bell).not.toMatch(/\[[^\]]*pathname[^\]]*\]/);
  });
});
