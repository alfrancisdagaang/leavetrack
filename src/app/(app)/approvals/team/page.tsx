import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingRegion } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { todayIn } from "@/lib/leave/calendar-layout";
import { TeamTabs } from "../team-tabs";
import { RosterSection } from "./roster-section";
import { RosterSkeleton } from "./roster-skeleton";

export const metadata: Metadata = { title: "Team approvals: My team" };
export const dynamic = "force-dynamic";

/**
 * US-12. A manager's direct reports with their leave status. Managers only (anyone else is sent to
 * the dashboard); the real scope is in the SQL, by the session user's id.
 */
export default async function TeamPage() {
  const { user } = await requireRole("manager");
  const today = todayIn(getEnv().APP_TIMEZONE ?? "UTC", new Date());

  return (
    <div>
      <PageHeader
        title="Team approvals"
        description="Your direct reports and their leave at a glance."
      />
      <TeamTabs active="team" />
      <Suspense
        fallback={
          <LoadingRegion>
            <RosterSkeleton />
          </LoadingRegion>
        }
      >
        <RosterSection managerId={user.id} today={today} />
      </Suspense>
    </div>
  );
}
