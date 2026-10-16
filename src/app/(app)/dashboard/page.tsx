import type { Metadata } from "next";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { LeaveCalendar } from "@/components/ui/leave-calendar";
import { SummaryCard } from "@/components/ui/summary-card";
import { requireSession } from "@/lib/auth/guards";
import { timedQuery } from "@/lib/db/timed";
import { getEnv } from "@/lib/env";
import type { BalanceSummaryItem } from "@/lib/leave/balance";
import { getCalendarRequests } from "@/lib/leave/calendar";
import {
  monthGrid,
  parseMonthParam,
  todayIn,
  type CalendarRequest,
} from "@/lib/leave/calendar-layout";
import { summaryCards, welcomeSubtitle } from "@/lib/leave/dashboard";
import { requireDb, getMySummary } from "@/lib/leave/service";
import { getTeamQueue } from "@/lib/leave/team";
import { logger } from "@/lib/logger";

export const metadata: Metadata = { title: "Dashboard" };

/** The signed-in user's own balances (scoped by their id in SQL). Null if unavailable. */
async function ownBalances(userId: string): Promise<BalanceSummaryItem[] | null> {
  try {
    return (await timedQuery("dashboard.balances", () => getMySummary(requireDb(), userId)))
      .balances;
  } catch (err) {
    logger.warn({ err }, "dashboard: balances unavailable");
    return null;
  }
}

/** Pending requests from the signed-in manager's own reports (scoped in SQL). Null if unavailable. */
async function pendingApprovalCount(managerId: string): Promise<number | null> {
  try {
    return (await timedQuery("dashboard.pending", () => getTeamQueue(requireDb(), managerId)))
      .length;
  } catch (err) {
    logger.warn({ err }, "dashboard: pending approval count unavailable");
    return null;
  }
}

/** The month's requests the viewer may see (scoped in SQL by role). Null if unavailable. */
async function calendarRequests(
  query: Parameters<typeof getCalendarRequests>[1],
): Promise<CalendarRequest[] | null> {
  try {
    return await timedQuery("dashboard.calendar", () => getCalendarRequests(requireDb(), query));
  } catch (err) {
    logger.warn({ err }, "dashboard: calendar unavailable");
    return null;
  }
}

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Post-login landing: a welcome block, the user's leave summary and the leave calendar. */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, role } = await requireSession();
  const params = await searchParams;
  const today = todayIn(getEnv().APP_TIMEZONE ?? "UTC", new Date());
  const month = parseMonthParam(first(params.month), today);
  const showRejected = first(params.rejected) === "1";
  const { from, to } = monthGrid(month);
  const approves = role === "manager" || role === "hr_admin";
  const [balances, pendingApprovals, requests] = await Promise.all([
    ownBalances(user.id),
    approves ? pendingApprovalCount(user.id) : Promise.resolve(null),
    calendarRequests({ role, userId: user.id, from, to, includeRejected: showRejected }),
  ]);
  const cards = summaryCards({ role, balances, pendingApprovals });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-72 space-y-2">
          <h1 className="text-2xl font-bold leading-tight text-ink sm:text-[28px]">
            Welcome back, {user.name}
          </h1>
          <p className="text-sm leading-normal text-ink-muted">
            {welcomeSubtitle(role, pendingApprovals)}
          </p>
        </div>
        <ButtonLink href="/requests/new" className="shrink-0">
          <Image src="/icons/plus.svg" alt="" width={20} height={20} unoptimized />
          Request Leave
        </ButtonLink>
      </div>
      <div
        className={`grid grid-cols-2 gap-4 ${cards.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
      >
        {cards.map((card) => (
          <SummaryCard key={card.key} card={card} />
        ))}
      </div>
      <LeaveCalendar
        role={role}
        viewerId={user.id}
        month={month}
        today={today}
        requests={requests}
        showRejected={showRejected}
      />
    </div>
  );
}
