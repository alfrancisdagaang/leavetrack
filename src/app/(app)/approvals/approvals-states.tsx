import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { CenteredCard } from "./team/team-states";

/** The pending queue could not be read: say so, and offer a way to try again. */
export function PendingError() {
  return (
    <CenteredCard icon="/icons/circle-alert.svg" tint="bg-rejected-bg">
      <div role="alert" className="space-y-1">
        <p className="font-semibold text-ink">Pending requests could not be loaded right now.</p>
        <p className="text-sm text-ink-muted">Try again in a moment.</p>
      </div>
      <ButtonLink href="/approvals" prefetch={false}>
        Try again
      </ButtonLink>
    </CenteredCard>
  );
}

/** Nothing is waiting for the manager. */
export function PendingEmpty() {
  return <p className="text-ink-muted">No pending requests from your team.</p>;
}

/** Recently decided is secondary, so its failure is a note, not a card; the queue above still works. */
export function DecidedError() {
  return (
    <Alert variant="error">
      Recently decided requests could not be loaded right now.{" "}
      <a href="/approvals" className="font-semibold underline">
        Try again
      </a>
    </Alert>
  );
}
