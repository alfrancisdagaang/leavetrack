import { CenteredCard } from "@/app/(app)/approvals/team/team-states";
import { ButtonLink } from "@/components/ui/button";

/** The calendar could not be read: say so, and offer a way to try again. */
export function CalendarError({ retryHref }: { retryHref: string }) {
  return (
    <CenteredCard icon="/icons/circle-alert.svg" tint="bg-rejected-bg">
      <div role="alert" className="space-y-1">
        <p className="font-semibold text-ink">The calendar could not be loaded right now.</p>
        <p className="text-sm text-ink-muted">Try again in a moment.</p>
      </div>
      <ButtonLink href={retryHref} prefetch={false}>
        Retry
      </ButtonLink>
    </CenteredCard>
  );
}

/** Nobody is out in the month shown. */
export function CalendarEmpty({ filtered, clearHref }: { filtered: boolean; clearHref: string }) {
  return (
    <CenteredCard icon="/icons/calendar-days.svg" tint="bg-brand-50">
      <p className="font-semibold text-ink">
        {filtered ? "Nobody is out this month with these filters." : "Nobody is out this month."}
      </p>
      {filtered ? (
        <ButtonLink href={clearHref} variant="secondary" prefetch={false}>
          Clear filters
        </ButtonLink>
      ) : null}
    </CenteredCard>
  );
}
