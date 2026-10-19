import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingRegion } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { todayIn } from "@/lib/leave/calendar-layout";
import { MemberPopup } from "./member-popup";
import { RosterSection } from "./roster-section";
import { RosterSkeleton } from "./roster-skeleton";

export const metadata: Metadata = { title: "My Team" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * US-12. A manager's direct reports as cards, with their leave status. Managers only (anyone else is
 * sent to the dashboard); the real scope is in the SQL, by the session user's id. A card opens that
 * person in a popup (`?member=<id>`), read in one more statement, under the same scope.
 */
export default async function TeamPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const { user } = await requireRole("manager");
  const today = todayIn(getEnv().APP_TIMEZONE ?? "UTC", new Date());
  const params = (await searchParams) ?? {};
  const raw = params.member;
  const memberParam = (Array.isArray(raw) ? raw[0] : raw) || undefined;

  return (
    <div>
      <PageHeader title="My Team" description="Your direct reports and their leave at a glance." />
      <Suspense
        fallback={
          <LoadingRegion>
            <RosterSkeleton />
          </LoadingRegion>
        }
      >
        <RosterSection managerId={user.id} today={today} />
      </Suspense>
      {memberParam ? (
        <Suspense fallback={null}>
          <MemberPopup
            managerId={user.id}
            memberParam={memberParam}
            searchParams={params}
            today={today}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
