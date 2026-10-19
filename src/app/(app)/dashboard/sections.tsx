import { LeaveCalendar } from "@/components/ui/leave-calendar";
import { RecentActivityCard } from "@/components/ui/recent-activity";
import { SummaryCard } from "@/components/ui/summary-card";
import { UpcomingLeaveCard } from "@/components/ui/upcoming-leave";
import { timedRead } from "@/lib/db/timed";
import { canApproveLeave, canRequestLeave } from "@/lib/auth/roles";
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
import { getOverrideCount } from "@/lib/leave/override-queue";
import { getOutFigures, type OutFigures, type OutScope } from "@/lib/leave/out-figures";
import { getDashboardSummary, requireDb } from "@/lib/leave/service";
import { getUpcomingLeave, type UpcomingLeave } from "@/lib/leave/upcoming";
import { logger } from "@/lib/logger";
import { OutStrip } from "./out-strip";
import { cardsGridClass } from "./skeletons";

/**
 * The dashboard's data sections. Each reads its own queries and sits in its own <Suspense> on the
 * page, so the welcome block shows at once and a slow or failed section only affects itself.
 * A failed read becomes null, which the section shows as "not available" instead of an error page.
 */

type SummaryData = { balances: BalanceSummaryItem[]; pendingApprovals: number | null };

/**
 * The summary cards' data in one read (one pooled connection): the signed-in user's own balances
 * and, for approvers, the pending count from their direct reports. Both are scoped by the session
 * user's id in SQL. Null if unavailable: every card then says so.
 */
async function summaryData(userId: string, countApprovals: boolean): Promise<SummaryData | null> {
  try {
    return await timedRead("dashboard.summary", () =>
      getDashboardSummary(requireDb(), userId, countApprovals),
    );
  } catch (err) {
    logger.warn({ err }, "dashboard: summary unavailable");
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

export const approvesLeave = canApproveLeave;

/** The override count for an HR admin's card (one statement). Null if unavailable. */
async function overrideCount(hrId: string): Promise<number | null> {
  try {
    return await timedRead("dashboard.override_count", () => getOverrideCount(requireDb(), hrId));
  } catch (err) {
    logger.warn({ err }, "dashboard: override count unavailable");
    return null;
  }
}

/** Who is out today and this week, company-wide or for the manager's team (one statement). Null if unavailable. */
async function outFigures(
  viewerId: string,
  scope: OutScope,
  today: IsoDate,
): Promise<OutFigures | null> {
  try {
    return await timedRead("dashboard.out_figures", () =>
      getOutFigures(requireDb(), { viewerId, scope, today }),
    );
  } catch (err) {
    logger.warn({ err }, "dashboard: out figures unavailable");
    return null;
  }
}

/**
 * The row of summary cards. An employee's balances (one read); a manager's pending approvals, who is
 * out today and in the next 7 days (one read); an HR admin's override count and who is out today and
 * every pending request (two reads), with the "Next 7 days" strip under the cards. Each role stays
 * within the page's parallel-statement budget.
 */
export async function SummarySection({
  role,
  userId,
  today,
}: {
  role: UserRole;
  userId: string;
  today: IsoDate;
}) {
  const hr = role === "hr_admin";
  const manager = canApproveLeave(role);
  const [data, overrides, out] = await Promise.all([
    canRequestLeave(role) ? summaryData(userId, false) : null,
    hr ? overrideCount(userId) : null,
    hr || manager ? outFigures(userId, hr ? "company" : "team", today) : null,
  ]);
  const cards = summaryCards({
    role,
    balances: data?.balances ?? null,
    pendingApprovals: manager ? (out?.pendingTotal ?? null) : null,
    overrides,
    out,
    today,
  });
  return (
    <div className="space-y-6">
      <div className={cardsGridClass(cards.length)}>
        {cards.map((card) => (
          <SummaryCard key={card.key} card={card} />
        ))}
      </div>
      {hr && out ? <OutStrip days={out.days} today={today} /> : null}
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
