import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { CenteredCard } from "../approvals/team/team-states";

/** The employee list could not be read: say so, and offer a way to try again. */
export function PolicyListError({ retryHref }: { retryHref: string }) {
  return (
    <CenteredCard icon="/icons/circle-alert.svg" tint="bg-rejected-bg">
      <div role="alert" className="space-y-1">
        <p className="font-semibold text-ink">Leave policies could not be loaded right now.</p>
        <p className="text-sm text-ink-muted">Try again in a moment.</p>
      </div>
      <ButtonLink href={retryHref} prefetch={false}>
        Try again
      </ButtonLink>
    </CenteredCard>
  );
}

/** There is nobody to configure. */
export function PolicyEmpty() {
  return <p className="py-2 text-ink-muted">There are no employees yet.</p>;
}

/** The search and filters matched nobody. */
export function PolicyNoMatches({ q, clearHref }: { q: string | undefined; clearHref: string }) {
  return (
    <div className="space-y-3 py-2">
      <p role="status" className="text-ink-muted">
        {q ? `No employees match “${q}” with these filters.` : "No employees match these filters."}
      </p>
      <ButtonLink href={clearHref} variant="secondary" prefetch={false}>
        Clear filters
      </ButtonLink>
    </div>
  );
}

/** Recent changes is secondary, so its failure is a note; the list above still works. */
export function RecentChangesError() {
  return (
    <Alert variant="error">
      Recent changes could not be loaded right now.{" "}
      <a href="/policies" className="font-semibold underline">
        Try again
      </a>
    </Alert>
  );
}
