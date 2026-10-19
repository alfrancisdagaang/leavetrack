import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { requireRole } from "@/lib/auth/guards";
import { timedRead } from "@/lib/db/timed";
import { getEnv } from "@/lib/env";
import { todayIn } from "@/lib/leave/calendar-layout";
import { memberIdSchema, parseTeamMemberQuery } from "@/lib/leave/schemas";
import { requireDb } from "@/lib/leave/service";
import { getTeamMemberPage, type TeamMemberPage } from "@/lib/leave/team-member";
import { logger } from "@/lib/logger";
import { MemberBalances } from "./member-balances";
import { FilterShell, ResultsRegion } from "@/components/ui/filter-shell";
import { MemberFilters } from "./member-filters";
import { BackToTeam, MemberHeader } from "./member-header";
import { MemberPagination } from "./member-pagination";
import { MemberRequests } from "./member-requests";
import { MemberError, NoMatches, PageOutOfRange } from "./member-states";
import { memberHref } from "./member-url";

export const metadata: Metadata = { title: "Team member" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * US-13. One direct report's balances and requests, with filters. Managers only.
 * The person comes from the address and is never trusted: the read finds them only if they report to
 * the signed-in user (in SQL), and a malformed address, another team's member, a missing person, a
 * deleted one and the caller themselves all end the same way: `notFound()`.
 */
export default async function TeamMemberRoute({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { user } = await requireRole("manager");
  const id = memberIdSchema.safeParse((await params).userId);
  if (!id.success) notFound();

  const today = todayIn(getEnv().APP_TIMEZONE ?? "UTC", new Date());
  const currentYear = Number(today.slice(0, 4));
  const { query, ignored } = parseTeamMemberQuery(await searchParams, currentYear);

  let data: TeamMemberPage | null;
  try {
    data = await timedRead("team.member", () =>
      getTeamMemberPage(requireDb(), user.id, id.data, query),
    );
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err }, "team: member unavailable");
    return (
      <div>
        <BackToTeam />
        <MemberError retryHref={memberHref(id.data, query, currentYear, query.page)} />
      </div>
    );
  }
  if (!data) notFound();

  const memberId = data.member.id;
  const hrefFor = (page: number) => memberHref(memberId, query, currentYear, page);

  return (
    <div>
      <MemberHeader member={data.member} />
      <MemberBalances balances={data.balances} />
      {ignored.length > 0 ? (
        <div className="mb-4">
          <Alert variant="info">
            {`These filters in the address were not valid and were ignored: ${ignored.join(", ")}.`}
          </Alert>
        </div>
      ) : null}
      <FilterShell>
        <MemberFilters
          memberId={memberId}
          query={query}
          leaveTypes={data.leaveTypes}
          currentYear={currentYear}
        />
        <ResultsRegion>
          {data.total === 0 ? (
            <NoMatches clearHref={`/approvals/team/${memberId}`} />
          ) : data.requests.length === 0 ? (
            <PageOutOfRange firstPageHref={hrefFor(1)} />
          ) : (
            <MemberRequests requests={data.requests} total={data.total}>
              <MemberPagination page={query.page} total={data.total} hrefFor={hrefFor} />
            </MemberRequests>
          )}
        </ResultsRegion>
      </FilterShell>
    </div>
  );
}
