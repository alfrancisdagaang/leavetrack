import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/guards";
import { getSessionSource } from "@/lib/auth/session";
import { ProfileFrame } from "../profile-frame";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Account settings" };
export const dynamic = "force-dynamic";

/** Account settings (TASK-065): the Security card. A mock-login session has no account to change. */
export default async function SettingsPage() {
  await requireSession();
  const source = await getSessionSource();
  return (
    <ProfileFrame active="settings">
      <Card title="Security">
        {source === "supabase" ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              Change your password. Your other devices are signed out when you do.
            </p>
            <PasswordForm />
          </div>
        ) : (
          <Alert variant="info">Password change is not available with the demo login.</Alert>
        )}
      </Card>
    </ProfileFrame>
  );
}
