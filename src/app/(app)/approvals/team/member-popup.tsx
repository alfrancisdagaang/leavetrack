import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { FilterShell, ResultsRegion } from "@/components/ui/filter-shell";
import { initialsOf } from "@/components/ui/initials";
import { timedRead } from "@/lib/db/timed";
import type { IsoDate } from "@/lib/leave/calendar-layout";
import { memberIdSchema, parseTeamMemberQuery } from "@/lib/leave/schemas";
import { requireDb } from "@/lib/leave/service";
import { getTeamMemberPage, type TeamMemberPage } from "@/lib/leave/team-member";
import { logger } from "@/lib/logger";
import { CloseLink, MemberDialog } from "./member-dialog";
import { MemberFilters } from "./[userId]/member-filters";
import { MemberPagination } from "./[userId]/member-pagination";
import { MemberRequests } from "./[userId]/member-requests";
import { MemberError, NoMatches, PageOutOfRange } from "./[userId]/member-states";
import { memberHref } from "./[userId]/member-url";
import { ROLE_LABEL } from "./team-format";

type SearchParams = Record<string, string | string[] | undefined>;

/** Where Close goes: the plain My Team page. */
export const TEAM_HREF = "/approvals/team";

/** A heading for a popup that has no person to show, so the dialog is still named. */
function Message({ children, extra }: { children: string; extra?: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 id="member-dialog-heading" className="text-lg font-semibold text-ink">
          {children}
        </h2>
        <CloseLink href={TEAM_HREF} />
      </div>
      {extra}
    </div>
  );
}

/**
 * One direct report in a popup over My Team: their name and role, the filters and their
 * requests. The same read as the member page (`getTeamMemberPage`, ONE statement), scoped in SQL by
 * the session user's id. The person comes from the address and is never trusted: another team's
 * member, a missing or deleted person, the manager themselves and a malformed id all end the same way
 * (one "couldn't find that person" message), so an address cannot be probed to find out who exists.
 * Approve and Reject on a pending request are the same controls as on the member page.
 */
export async function MemberPopup({
  managerId,
  memberParam,
  searchParams,
  today,
}: {
  managerId: string;
  memberParam: string;
  searchParams: SearchParams;
  today: IsoDate;
}) {
  const id = memberIdSchema.safeParse(memberParam);
  if (!id.success) {
    return (
      <MemberDialog closeHref={TEAM_HREF}>
        <Message>We couldn&apos;t find that person on your team.</Message>
      </MemberDialog>
    );
  }

  const currentYear = Number(today.slice(0, 4));
  const { query, ignored } = parseTeamMemberQuery(searchParams, currentYear);
  const hrefFor = (page: number) => memberHref(id.data, query, currentYear, page, true);

  let data: TeamMemberPage | null;
  try {
    data = await timedRead("team.member", () =>
      getTeamMemberPage(requireDb(), managerId, id.data, query),
    );
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err }, "team: member unavailable");
    return (
      <MemberDialog closeHref={TEAM_HREF}>
        <Message extra={<MemberError retryHref={hrefFor(query.page)} />}>
          This person&apos;s requests could not be loaded.
        </Message>
      </MemberDialog>
    );
  }

  if (!data) {
    return (
      <MemberDialog closeHref={TEAM_HREF}>
        <Message>We couldn&apos;t find that person on your team.</Message>
      </MemberDialog>
    );
  }

  const member = data.member;
  return (
    <MemberDialog closeHref={TEAM_HREF}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base font-semibold text-brand-600"
          >
            {initialsOf(member.name)}
          </span>
          <div className="min-w-0">
            <h2
              id="member-dialog-heading"
              className="truncate text-2xl font-semibold tracking-tight text-ink"
            >
              {member.name}
            </h2>
            <p className="text-ink-muted">{ROLE_LABEL[member.role]}</p>
          </div>
        </div>
        <CloseLink href={TEAM_HREF} />
      </div>
      {ignored.length > 0 ? (
        <div className="mb-4">
          <Alert variant="info">
            {`These filters in the address were not valid and were ignored: ${ignored.join(", ")}.`}
          </Alert>
        </div>
      ) : null}
      <FilterShell>
        <MemberFilters
          memberId={member.id}
          query={query}
          leaveTypes={data.leaveTypes}
          currentYear={currentYear}
          popup
        />
        <ResultsRegion>
          {data.total === 0 ? (
            <NoMatches
              clearHref={memberHref(
                member.id,
                { ...query, leaveTypeId: undefined, status: undefined, year: currentYear, page: 1 },
                currentYear,
                1,
                true,
              )}
            />
          ) : data.requests.length === 0 ? (
            <PageOutOfRange firstPageHref={hrefFor(1)} />
          ) : (
            <MemberRequests requests={data.requests} total={data.total}>
              <MemberPagination page={query.page} total={data.total} hrefFor={hrefFor} />
            </MemberRequests>
          )}
        </ResultsRegion>
      </FilterShell>
    </MemberDialog>
  );
}
