import { unstable_rethrow } from "next/navigation";
import { timedRead } from "@/lib/db/timed";
import type { IsoDate } from "@/lib/leave/calendar-layout";
import { requireDb } from "@/lib/leave/service";
import { getTeamRoster, type RosterMember } from "@/lib/leave/team-roster";
import { logger } from "@/lib/logger";
import { RosterRow } from "./roster-row";
import { ROSTER_CELL, ROSTER_GRID } from "./roster-grid";
import { TeamEmpty, TeamError } from "./team-states";

/**
 * US-12. The signed-in manager's direct reports as a grid of cards, scoped by their id in SQL. A card
 * opens that person in a popup on this page (`?member=<id>`). Streams in under the page header. One
 * statement. If it cannot be read the page says so with a way to retry; the rest of the
 * app keeps working.
 */
export async function RosterSection({ managerId, today }: { managerId: string; today: IsoDate }) {
  let roster: RosterMember[];
  try {
    roster = await timedRead("team.roster", () => getTeamRoster(requireDb(), managerId, today));
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err }, "team: roster unavailable");
    return <TeamError />;
  }

  if (roster.length === 0) return <TeamEmpty />;

  return (
    <ul aria-label="Your direct reports" className={ROSTER_GRID}>
      {roster.map((member) => (
        <li key={member.id} className={ROSTER_CELL}>
          <RosterRow member={member} href={`/approvals/team?member=${member.id}`} />
        </li>
      ))}
    </ul>
  );
}
