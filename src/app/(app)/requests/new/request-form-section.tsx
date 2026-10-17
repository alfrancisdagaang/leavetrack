import { unstable_rethrow } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { timedRead } from "@/lib/db/timed";
import type { BalanceSummaryItem } from "@/lib/leave/balance";
import { getBalanceSummary, requireDb } from "@/lib/leave/service";
import { logger } from "@/lib/logger";
import { RequestForm } from "./request-form";

/**
 * The form with its leave types. It reads the user's own balances (scoped by their id in SQL), so
 * the page can show its header first and stream this part in. A failed read shows a message and a
 * way to retry instead of crashing the page.
 */
export async function RequestFormSection({ userId }: { userId: string }) {
  let balances: BalanceSummaryItem[];
  try {
    balances = await timedRead("requests_new.summary", () =>
      getBalanceSummary(requireDb(), userId),
    );
  } catch (err) {
    unstable_rethrow(err);
    logger.warn({ err }, "requests/new: leave types unavailable");
    return (
      <div className="space-y-4">
        <Alert variant="error">
          The leave types could not be loaded right now. Try again in a moment.
        </Alert>
        <ButtonLink href="/requests/new" variant="secondary" prefetch={false}>
          Try again
        </ButtonLink>
      </div>
    );
  }

  if (balances.length === 0) {
    return <Alert variant="error">No leave types are set up yet.</Alert>;
  }
  return <RequestForm balances={balances} />;
}
