import { LeaveCalendar } from "@/components/ui/leave-calendar";
import { SummaryCard } from "@/components/ui/summary-card";
import { timedRead } from "@/lib/db/timed";
import type { UserRole } from "@/lib/db/types";
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
