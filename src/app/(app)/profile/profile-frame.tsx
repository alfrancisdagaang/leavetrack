import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileTabs, type ProfileTab } from "./profile-tabs";

/** The header and tabs every My Profile page starts with; the tab's own content goes below. */
export function ProfileFrame({ active, children }: { active: ProfileTab; children: ReactNode }) {
  return (
    <div>
      <PageHeader
        title="My Profile"
        description="Your profile, your place in the organization and your account."
      />
      <ProfileTabs active={active} />
      {children}
    </div>
  );
}
