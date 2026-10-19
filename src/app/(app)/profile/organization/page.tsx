import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRegion } from "@/components/ui/skeleton";
import { requireSession } from "@/lib/auth/guards";
import { ProfileFrame } from "../profile-frame";
import { OrgSection } from "./org-section";
import { OrgSkeleton } from "./org-skeleton";

export const metadata: Metadata = { title: "Organization" };
export const dynamic = "force-dynamic";

/** EPIC-11, Organization. The header and tabs show at once; the chart for the signed-in role streams in below. */
export default async function OrganizationPage() {
  const { role, user } = await requireSession();

  return (
    <ProfileFrame active="organization">
      <Suspense
        fallback={
          <LoadingRegion>
            <OrgSkeleton />
          </LoadingRegion>
        }
      >
        <OrgSection role={role} viewer={{ id: user.id, name: user.name, email: user.email }} />
      </Suspense>
    </ProfileFrame>
  );
}
