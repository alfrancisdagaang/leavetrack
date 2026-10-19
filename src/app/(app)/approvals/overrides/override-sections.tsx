import { unstable_rethrow } from "next/navigation";
import { timedRead } from "@/lib/db/timed";
import {
  getOverrideQueue,
  getRecentOverrides,
  type OverrideQueue,
  type RecentOverrideView,
} from "@/lib/leave/override-queue";
import { requireDb } from "@/lib/leave/service";
import { logger } from "@/lib/logger";
import { OverrideRow, RecentOverrideRow } from "./override-row";
import {
  OverrideQueueCapped,
  OverrideQueueEmpty,
  OverrideQueueError,
  RecentOverridesError,
} from "./overrides-states";

/**
 * TASK-039. Every pending request that asks for more days than the employee has, from every team
 * (not the signed-in HR Admin's own). The scope is in the SQL (see `override-queue.ts`); the page
 * only gets rows the TASK-038 route would accept. One statement; if it cannot be read the section
 * says so with a way to retry instead of sending the whole page to the error page.
 */
export async function OverrideQueueSection({ hrId }: { hrId: string }) {
  let queue: OverrideQueue;
  try {
    queue = await timedRead("overrides.queue", () => getOverrideQueue(requireDb(), hrId));
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err }, "overrides: queue unavailable");
    return <OverrideQueueError />;
  }

  return (
    <section aria-labelledby="override-queue-heading">
      <h2 id="override-queue-heading" className="mb-3 text-xl font-semibold text-ink">
        {`Waiting for an override (${queue.total})`}
      </h2>
      {queue.rows.length === 0 ? (
        <OverrideQueueEmpty />
      ) : (
        <>
          {queue.total > queue.rows.length ? (
            <OverrideQueueCapped shown={queue.rows.length} total={queue.total} />
          ) : null}
          <ul aria-label="Requests waiting for an override" className="space-y-3">
            {queue.rows.map((request) => (
              <OverrideRow key={request.id} request={request} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** The latest override approvals (at most 10). Nothing is shown when there are none. */
export async function RecentOverridesSection({ now, timeZone }: { now: Date; timeZone: string }) {
  let recent: RecentOverrideView[];
  try {
    recent = await timedRead("overrides.recent", () => getRecentOverrides(requireDb()));
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err }, "overrides: recent overrides unavailable");
    return <RecentOverridesError />;
  }
  if (recent.length === 0) return null;

  return (
    <section aria-labelledby="recent-overrides-heading">
      <h2 id="recent-overrides-heading" className="mb-3 text-xl font-semibold text-ink">
        Recently overridden
      </h2>
      <ul aria-label="Recently overridden requests" className="space-y-3">
        {recent.map((override) => (
          <RecentOverrideRow key={override.id} override={override} now={now} timeZone={timeZone} />
        ))}
      </ul>
    </section>
  );
}
