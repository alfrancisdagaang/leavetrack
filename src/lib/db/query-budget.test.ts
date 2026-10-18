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
}));
vi.mock("@/lib/auth/guards", () => ({
  requireRole: async () => ({ role: "manager", user: { id: "m1", name: "Marco" } }),
}));
vi.mock("@/lib/leave/service", async (importOriginal) => ({
  ...(await importOriginal<typeof ServiceModule>()),
  requireDb: () => holder.sql,
}));

/** Answers every statement with no rows, except the balance summary, which is a single row. */
function trackingSql() {
  let inFlight = 0;
  let peak = 0;
  const sql = (strings: TemplateStringsArray) => {
    const text = strings.join("?");
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    const rows = /json_agg\(/.test(text)
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
const { default: ApprovalsPage } = await import("@/app/(app)/approvals/page");

let tracker: ReturnType<typeof trackingSql>;
beforeEach(() => {
  tracker = trackingSql();
  holder.sql = tracker.sql;
});

const dashboard = (role: "employee" | "manager" | "hr_admin") =>
  Promise.all([
    SummarySection({ role, userId: "u1" }),
    CalendarSection({
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

  it("Request Leave stays within the budget", async () => {
    await RequestFormSection({ userId: "u1" });
    expect(tracker.peak()).toBeGreaterThan(0);
    expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
  });

  it("My Balance stays within the budget", async () => {
    await BalanceSection({ userId: "u1" });
    expect(tracker.peak()).toBeGreaterThan(0);
    expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
  });

  it("Team approvals stays within the budget", async () => {
    await ApprovalsPage();
    expect(tracker.peak()).toBeGreaterThan(0);
    expect(tracker.peak()).toBeLessThanOrEqual(BUDGET);
  });
});
