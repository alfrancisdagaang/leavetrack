import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { CenteredCard } from "../team/team-states";

/** The queue could not be read: say so, and offer a way to try again. */
export function OverrideQueueError() {
  return (
    <CenteredCard icon="/icons/circle-alert.svg" tint="bg-rejected-bg">
      <div role="alert" className="space-y-1">
        <p className="font-semibold text-ink">Override requests could not be loaded right now.</p>
        <p className="text-sm text-ink-muted">Try again in a moment.</p>
      </div>
      <ButtonLink href="/approvals/overrides" prefetch={false}>
        Try again
      </ButtonLink>
    </CenteredCard>
  );
}

/** Nothing is waiting for HR. */
export function OverrideQueueEmpty() {
  return <p className="py-2 text-ink-muted">No requests are waiting for an HR override.</p>;
}

/** Shown when more requests wait than the page lists. */
export function OverrideQueueCapped({ shown, total }: { shown: number; total: number }) {
  return (
    <p role="status" className="mb-3 text-sm text-ink-muted">
      Showing the oldest {shown} of {total}. Decide some to see the rest.
    </p>
  );
}

/** Recently overridden is secondary, so its failure is a note; the queue above still works. */
export function RecentOverridesError() {
  return (
    <Alert variant="error">
      Recently overridden requests could not be loaded right now.{" "}
      <a href="/approvals/overrides" className="font-semibold underline">
        Try again
      </a>
    </Alert>
  );
}
