import Image from "next/image";
import { Card } from "@/components/ui/card";
import { initialsOf } from "@/components/ui/initials";
import type { UserRole } from "@/lib/db/types";
import type { OrgNode } from "@/lib/leave/org";
import { ROLE_LABEL } from "../../approvals/team/team-format";
import { YouPill } from "./org-person";

/**
 * The summary at the top of the Organization tab: who the viewer is (avatar, name, "You", role) and
 * their own email and manager. All of it is the viewer's OWN data: the name and email come from the
 * session user, the manager from the chart read. `manager` undefined leaves the line out (HR's own
 * manager could not be read); null reads "No manager". The chart below shows no email.
 */
export function ProfileSummary({
  name,
  role,
  email,
  manager,
}: {
  name: string;
  role: UserRole;
  email: string;
  manager?: OrgNode | null;
}) {
  return (
    <Card>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl font-bold text-brand-500"
          >
            {initialsOf(name)}
          </span>
          <div className="min-w-0">
            <p className="break-words text-lg font-semibold text-ink [overflow-wrap:anywhere]">
              {name}
              <YouPill />
            </p>
            <p className="text-ink-muted">{ROLE_LABEL[role]}</p>
          </div>
        </div>
        <dl className="grid min-w-0 content-center gap-4 border-t border-line pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div className="flex min-w-0 items-start gap-3">
            <Image
              src="/icons/mail-dark.svg"
              alt=""
              width={20}
              height={20}
              unoptimized
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0">
              <dt className="text-xs text-ink-muted">Email</dt>
              <dd className="break-all text-sm font-medium text-ink">{email}</dd>
            </div>
          </div>
          {manager === undefined ? null : (
            <div className="flex min-w-0 items-start gap-3">
              <Image
                src="/icons/user-dark.svg"
                alt=""
                width={20}
                height={20}
                unoptimized
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0">
                <dt className="text-xs text-ink-muted">Manager</dt>
                <dd className="break-words text-sm font-medium text-ink [overflow-wrap:anywhere]">
                  {manager ? manager.name : "No manager"}
                </dd>
              </div>
            </div>
          )}
        </dl>
      </div>
    </Card>
  );
}
