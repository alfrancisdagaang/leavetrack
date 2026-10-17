import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { LoadingRegion } from "@/components/ui/skeleton";
import { requireSession } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { monthKey, parseMonthParam, todayIn } from "@/lib/leave/calendar-layout";
import { welcomeSubtitle } from "@/lib/leave/dashboard";
import { approvesLeave, CalendarSection, SummarySection } from "./sections";
import { CalendarSkeleton, SummaryCardsSkeleton } from "./skeletons";

export const metadata: Metadata = { title: "Dashboard" };

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Post-login landing: a welcome block, the user's leave summary and the leave calendar. Only the
 * session is awaited here; the summary and the calendar stream in on their own, so a slow query
 * never holds back the rest of the page.
 */
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-72 space-y-2">
          <h1 className="text-2xl font-bold leading-tight text-ink sm:text-[28px]">
            Welcome back, {user.name}
          </h1>
          <p className="text-sm leading-normal text-ink-muted">{welcomeSubtitle(role, null)}</p>
        </div>
        <ButtonLink href="/requests/new" prefetch={false} className="shrink-0">
          <Image src="/icons/plus.svg" alt="" width={20} height={20} unoptimized />
          Request Leave
        </ButtonLink>
      </div>
      <Suspense
        fallback={
          <LoadingRegion>
            <SummaryCardsSkeleton count={approvesLeave(role) ? 4 : 3} />
          </LoadingRegion>
        }
      >
        <SummarySection role={role} userId={user.id} />
      </Suspense>
      <Suspense
        key={`${monthKey(month)}-${showRejected}`}
        fallback={
          <LoadingRegion>
            <CalendarSkeleton />
          </LoadingRegion>
        }
      >
        <CalendarSection
          role={role}
          viewerId={user.id}
          month={month}
          today={today}
          showRejected={showRejected}
        />
      </Suspense>
    </div>
  );
}
