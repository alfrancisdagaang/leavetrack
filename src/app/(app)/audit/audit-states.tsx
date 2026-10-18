import { ButtonLink } from "@/components/ui/button";
import { CenteredCard } from "@/app/(app)/approvals/team/team-states";

/** The audit list could not be read: say so, and offer a way to try again. */
export function AuditError({ retryHref }: { retryHref: string }) {
  return (
    <CenteredCard icon="/icons/circle-alert.svg" tint="bg-rejected-bg">
      <div role="alert" className="space-y-1">
        <p className="font-semibold text-ink">The audit log could not be loaded right now.</p>
        <p className="text-sm text-ink-muted">Try again in a moment.</p>
      </div>
      <ButtonLink href={retryHref} prefetch={false}>
        Try again
      </ButtonLink>
    </CenteredCard>
  );
}

/** The filters match nothing. */
export function AuditNoMatches({ clearHref }: { clearHref: string }) {
  return (
    <CenteredCard icon="/icons/clipboard-list.svg" tint="bg-brand-50">
      <p className="font-semibold text-ink">No requests match these filters.</p>
      <ButtonLink href={clearHref} variant="secondary" prefetch={false}>
        Clear filters
      </ButtonLink>
    </CenteredCard>
  );
}

/** There are no requests at all yet. */
export function AuditEmpty() {
  return (
    <CenteredCard icon="/icons/clipboard-list.svg" tint="bg-brand-50">
      <p className="font-semibold text-ink">There are no leave requests yet.</p>
    </CenteredCard>
  );
}
