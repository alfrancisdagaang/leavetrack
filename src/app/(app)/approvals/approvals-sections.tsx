import { unstable_rethrow } from "next/navigation";
import { timedRead } from "@/lib/db/timed";
import { requireDb } from "@/lib/leave/service";
import {
  getRecentlyDecided,
  getTeamQueue,
  type DecidedTeamRequestView,
  type TeamRequestView,
} from "@/lib/leave/team";
import { logger } from "@/lib/logger";
import { ApprovalRow } from "./approval-row";
import { DecidedError, PendingEmpty, PendingError } from "./approvals-states";
import { DecidedRow } from "./decided-row";

/**
 * US-03 / US-04. Pending requests from the signed-in manager's own direct reports. The scope is in
 * the SQL (`u.manager_id = the session user's id`); the page never receives another team's requests.
 * Streams in under the page header and tabs. One statement; if it cannot be read the section says so
 * with a way to retry instead of sending the whole page to the error page.
 */
export async function PendingSection({ managerId }: { managerId: string }) {
  let queue: TeamRequestView[];
  try {
    queue = await timedRead("approvals.queue", () => getTeamQueue(requireDb(), managerId));
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err }, "approvals: queue unavailable");
    return <PendingError />;
  }

  return (
    <section aria-labelledby="pending-heading">
      <h2 id="pending-heading" className="mb-3 text-xl font-semibold text-ink">
        {`Pending requests (${queue.length})`}
      </h2>
      {queue.length === 0 ? (
        <PendingEmpty />
      ) : (
        <ul aria-label="Pending requests" className="space-y-3">
          {queue.map((request) => (
            <ApprovalRow key={request.id} request={request} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** The team's most recent decisions (at most 10), scoped the same way. Nothing is shown when there are none. */
export async function DecidedSection({ managerId }: { managerId: string }) {
  let decided: DecidedTeamRequestView[];
  try {
    decided = await timedRead("approvals.decided", () =>
      getRecentlyDecided(requireDb(), managerId),
    );
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err }, "approvals: recently decided unavailable");
    return <DecidedError />;
  }
  if (decided.length === 0) return null;

  return (
    <section aria-labelledby="decided-heading">
      <h2 id="decided-heading" className="mb-3 text-xl font-semibold text-ink">
        Recently decided
      </h2>
      <ul aria-label="Recently decided requests" className="space-y-3">
        {decided.map((request) => (
          <DecidedRow key={request.id} request={request} />
        ))}
      </ul>
    </section>
  );
}
