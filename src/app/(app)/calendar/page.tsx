import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { monthKey, monthOf, todayIn } from "@/lib/leave/calendar-layout";
import { parseHrCalendarQuery } from "@/lib/leave/schemas";
import { CalendarBody } from "./calendar-body";
import { CalendarSkeleton } from "./calendar-skeleton";
import { calendarHref } from "./calendar-url";

export const metadata: Metadata = { title: "Company Calendar" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * EPIC-7. HR's company calendar: how many people are out each weekday, filtered by team and leave
 * type, and a day opens the list of who is out. HR admins only; read-only. The month, the filters and
 * the open day live in the address, so the forms are plain GET forms that also work without JavaScript.
 * The header shows at once and the month streams in.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireRole("hr_admin");
  const today = todayIn(getEnv().APP_TIMEZONE ?? "UTC", new Date());
  const { query, ignored } = parseHrCalendarQuery(await searchParams, monthKey(monthOf(today)));

  return (
    <div>
      <PageHeader title="Company Calendar" description="See how many people are out each day." />
      {ignored.length > 0 ? (
        <div className="mb-4">
          <Alert variant="info">
            {`These filters in the address were not valid and were ignored: ${ignored.join(", ")}.`}
          </Alert>
        </div>
      ) : null}
      <Suspense
        key={calendarHref(query, { day: undefined, q: undefined, page: 1 })}
        fallback={<CalendarSkeleton />}
      >
        <CalendarBody viewerId={session.user.id} query={query} today={today} />
      </Suspense>
    </div>
  );
}
