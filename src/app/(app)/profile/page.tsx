import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRegion } from "@/components/ui/skeleton";
import { requireSession } from "@/lib/auth/guards";
import { OverviewSection } from "./overview-section";
import { OverviewSkeleton } from "./overview-skeleton";
import { ProfileFrame } from "./profile-frame";

export const metadata: Metadata = { title: "My Profile" };
export const dynamic = "force-dynamic";

/** EPIC-11, Overview. Every role sees their own profile; the header and tabs show at once. */
export default async function ProfilePage() {
  const { user } = await requireSession();

  return (
    <ProfileFrame active="overview">
      <Suspense
        fallback={
          <LoadingRegion>
            <OverviewSkeleton />
          </LoadingRegion>
        }
      >
        <OverviewSection userId={user.id} />
      </Suspense>
    </ProfileFrame>
  );
}
