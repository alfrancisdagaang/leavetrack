import { unstable_rethrow } from "next/navigation";
import { Card } from "@/components/ui/card";
import { initialsOf } from "@/components/ui/initials";
import { timedRead } from "@/lib/db/timed";
import { requireDb } from "@/lib/leave/service";
import { getProfile, type Profile } from "@/lib/leave/profile";
import { logger } from "@/lib/logger";
import { ROLE_LABEL } from "../approvals/team/team-format";
import { OverviewError } from "./profile-states";

/** One label and value. Long unbroken values wrap instead of widening the page. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1 break-words font-medium text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/**
 * The Overview tab: an initials avatar, the name, the role in words, the email and the manager's
 * name ("No manager" at the top of the chart). One statement, scoped to the session user's own id.
 * No department, job title, photo or link to anyone else's profile (decided 2026-10-19). If the read
 * fails the tab says so and the rest of the page still works.
 */
export async function OverviewSection({ userId }: { userId: string }) {
  const profile = await timedRead("profile.overview", () => getProfile(requireDb(), userId)).catch(
    (err: unknown): null => {
      unstable_rethrow(err);
      logger.warn({ err }, "profile: overview unavailable");
      return null;
    },
  );
  if (!profile) return <OverviewError />;
  return <OverviewCard profile={profile} />;
}

export function OverviewCard({ profile }: { profile: Profile }) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl font-bold text-brand-500"
        >
          {initialsOf(profile.name)}
        </span>
        <div className="min-w-0">
          <h2 className="break-words text-xl font-semibold text-ink [overflow-wrap:anywhere]">
            {profile.name}
          </h2>
          <p className="text-ink-muted">{ROLE_LABEL[profile.role]}</p>
        </div>
      </div>
      <hr className="my-5 border-line" />
      <dl className="grid gap-5 sm:grid-cols-2">
        <Field label="Email">{profile.email}</Field>
        <Field label="Manager">{profile.managerName ?? "No manager"}</Field>
      </dl>
    </Card>
  );
}
