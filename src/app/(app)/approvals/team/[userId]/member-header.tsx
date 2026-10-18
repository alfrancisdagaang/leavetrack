import Image from "next/image";
import Link from "next/link";
import { initialsOf } from "@/components/ui/initials";
import type { TeamMemberPage } from "@/lib/leave/team-member";
import { ROLE_LABEL } from "../team-format";

/** The way back to the roster. Shown on the member page and also when the page cannot load. */
export function BackToTeam() {
  return (
    <Link
      href="/approvals/team"
      prefetch={false}
      className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink hover:underline"
    >
      <Image src="/icons/chevron-left.svg" alt="" width={20} height={20} unoptimized />
      Back to My team
    </Link>
  );
}

/** A back link, the person's avatar, their name (the page's h1) and their role. */
export function MemberHeader({ member }: { member: TeamMemberPage["member"] }) {
  return (
    <div className="mb-6">
      <BackToTeam />
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base font-semibold text-brand-600"
        >
          {initialsOf(member.name)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{member.name}</h1>
          <p className="text-ink-muted">{ROLE_LABEL[member.role]}</p>
        </div>
      </div>
    </div>
  );
}
