import { LeaveCalendar } from "@/components/ui/leave-calendar";
import { RecentActivityCard } from "@/components/ui/recent-activity";
import { SummaryCard } from "@/components/ui/summary-card";
import { UpcomingLeaveCard } from "@/components/ui/upcoming-leave";
import { timedRead } from "@/lib/db/timed";
import type { UserRole } from "@/lib/db/types";
import { getRecentActivity, type ActivityEvent } from "@/lib/leave/activity";
import type { BalanceSummaryItem } from "@/lib/leave/balance";
import { getCalendarRequests } from "@/lib/leave/calendar";
import {
  monthGrid,
  type CalendarRequest,
  type IsoDate,
  type MonthRef,
} from "@/lib/leave/calendar-layout";
import { summaryCards } from "@/lib/leave/dashboard";
import { getBalanceSummary, requireDb } from "@/lib/leave/service";
import { getTeamQueue } from "@/lib/leave/team";
import { getUpcomingLeave, type UpcomingLeave } from "@/lib/leave/upcoming";
import { logger } from "@/lib/logger";
import { cardsGridClass } from "./skeletons";

/**
 * The dashboard's data sections. Each reads its own queries and sits in its own <Suspense> on the
 * page, so the welcome block shows at once and a slow or failed section only affects itself.
 * A failed read becomes null, which the section shows as "not available" instead of an error page.
 */

/** The signed-in user's own balances (scoped by their id in SQL). Null if unavailable. */
async function ownBalances(userId: string): Promise<BalanceSummaryItem[] | null> {
  try {
    return await timedRead("dashboard.balances", () => getBalanceSummary(requireDb(), userId));
  } catch (err) {
    logger.warn({ err }, "dashboard: balances unavailable");
    return null;
  }
}

/** Pending requests from the signed-in manager's own reports (scoped in SQL). Null if unavailable. */
async function pendingApprovalCount(managerId: string): Promise<number | null> {
  try {
    return (await timedRead("dashboard.pending", () => getTeamQueue(requireDb(), managerId)))
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
    return await timedRead("dashboard.calendar", () => getCalendarRequests(requireDb(), query));
  } catch (err) {
    logger.warn({ err }, "dashboard: calendar unavailable");
    return null;
  }
}

/** The next leave the viewer may see (scoped in SQL by role). Null if unavailable. */
async function upcomingLeave(
  query: Parameters<typeof getUpcomingLeave>[1],
): Promise<UpcomingLeave[] | null> {
  try {
    return await timedRead("dashboard.upcoming", () => getUpcomingLeave(requireDb(), query));
  } catch (err) {
    logger.warn({ err }, "dashboard: upcoming leave unavailable");
    return null;
  }
}

/** The latest decision events the viewer may see (scoped in SQL by role). Null if unavailable. */
async function recentActivity(
  query: Parameters<typeof getRecentActivity>[1],
): Promise<ActivityEvent[] | null> {
  try {
    return await timedRead("dashboard.activity", () => getRecentActivity(requireDb(), query));
  } catch (err) {
    logger.warn({ err }, "dashboard: recent activity unavailable");
    return null;
  }
}

export const approvesLeave = (role: UserRole) => role === "manager" || role === "hr_admin";

/** The row of summary cards: the user's balances and, for approvers, the pending count. */
export async function SummarySection({ role, userId }: { role: UserRole; userId: string }) {
  const [balances, pendingApprovals] = await Promise.all([
    ownBalances(userId),
    approvesLeave(role) ? pendingApprovalCount(userId) : Promise.resolve(null),
  ]);
  const cards = summaryCards({ role, balances, pendingApprovals });
  return (
    <div className={cardsGridClass(cards.length)}>
      {cards.map((card) => (
        <SummaryCard key={card.key} card={card} />
      ))}
    </div>
  );
}

/** The leave calendar for one month, scoped by role in SQL. */
export async function CalendarSection({
  role,
  viewerId,
  month,
  today,
  showRejected,
}: {
  role: UserRole;
  viewerId: string;
  month: MonthRef;
  today: IsoDate;
  showRejected: boolean;
}) {
  const { from, to } = monthGrid(month);
  const requests = await calendarRequests({
    role,
    userId: viewerId,
    from,
    to,
    includeRejected: showRejected,
  });
  return (
    <LeaveCalendar
      role={role}
      viewerId={viewerId}
      month={month}
      today={today}
      requests={requests}
      showRejected={showRejected}
    />
  );
}

/** The "Upcoming leave" card, scoped by role in SQL. */
export async function UpcomingSection({
  role,
  viewerId,
  today,
}: {
  role: UserRole;
  viewerId: string;
  today: IsoDate;
}) {
  const items = await upcomingLeave({ role, userId: viewerId, today });
  return <UpcomingLeaveCard items={items} viewerId={viewerId} today={today} />;
}

/** The "Recent activity" card, scoped by role in SQL. */
export async function ActivitySection({
  role,
  viewerId,
  timeZone,
}: {
  role: UserRole;
  viewerId: string;
  timeZone: string;
}) {
  const events = await recentActivity({ role, userId: viewerId });
  return <RecentActivityCard events={events} now={new Date()} timeZone={timeZone} />;
}
