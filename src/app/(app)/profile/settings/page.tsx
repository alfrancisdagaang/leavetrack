import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/guards";
import { ProfileFrame } from "../profile-frame";
import { ComingSoon } from "../profile-states";

export const metadata: Metadata = { title: "Account settings" };
export const dynamic = "force-dynamic";

/** Placeholder until TASK-065 adds the change password form. */
export default async function SettingsPage() {
  await requireSession();
  return (
    <ProfileFrame active="settings">
      <ComingSoon what="Account settings" />
    </ProfileFrame>
  );
}
