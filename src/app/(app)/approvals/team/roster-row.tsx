import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { initialsOf } from "@/components/ui/initials";
import type { RosterMember } from "@/lib/leave/team-roster";
import { formatDays, rosterStatusText, STATUS_BADGE } from "./team-format";

const ROW = "relative block rounded-tile border border-brand-50 bg-white p-4 shadow-tile sm:p-5";

/** One direct report on My Team (US-12). Presentational: the member arrives as a prop. */
export function RosterRow({ member, href }: { member: RosterMember; href?: string }) {
  const pending = member.pendingCount;
  const last = member.lastRequest;

  const content = (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_auto_minmax(0,1.5fr)_minmax(0,1.3fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3 pr-8 sm:pr-0">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600"
        >
          {initialsOf(member.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{member.name}</p>
          <p className="text-sm text-ink-muted">{rosterStatusText(member.status)}</p>
        </div>
      </div>

      <div>
        <Badge variant={pending > 0 ? "pending" : "neutral"}>{`${pending} pending`}</Badge>
      </div>

      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        {member.balances.map((b) => (
          <div key={b.leaveTypeId}>
            <dt className="text-xs text-ink-muted">{b.leaveTypeName}</dt>
            <dd className="font-medium text-ink">{formatDays(b.available ?? 0)}</dd>
          </div>
        ))}
      </dl>

      <div>
        <p className="text-xs text-ink-muted">Last request</p>
        {last ? (
          <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
            {last.leaveTypeName}
            <Badge variant={STATUS_BADGE[last.status].variant}>
              {STATUS_BADGE[last.status].label}
            </Badge>
          </p>
        ) : (
          <p className="text-ink-muted">No requests yet</p>
        )}
      </div>

      {href ? (
        <Image
          src="/icons/chevron-right.svg"
          alt=""
          width={20}
          height={20}
          unoptimized
          className="absolute right-4 top-6 shrink-0 sm:static"
        />
      ) : null}
    </div>
  );

  return href ? (
    <Link
      href={href}
      prefetch={false}
      className={`${ROW} transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`}
    >
      {content}
    </Link>
  ) : (
    <div className={ROW}>{content}</div>
  );
}
