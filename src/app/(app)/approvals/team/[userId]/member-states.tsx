import Image from "next/image";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function CenteredCard({
  icon,
  tint,
  children,
}: {
  icon: string;
  tint: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span
          aria-hidden="true"
          className={`flex size-12 items-center justify-center rounded-full ${tint}`}
        >
          <Image src={icon} alt="" width={24} height={24} unoptimized />
        </span>
        {children}
      </div>
    </Card>
  );
}

/** The person's data could not be read: say so, and offer a way to try again (US-13 AC8). */
export function MemberError({ retryHref }: { retryHref: string }) {
  return (
    <CenteredCard icon="/icons/circle-alert.svg" tint="bg-rejected-bg">
      <div role="alert" className="space-y-1">
        <p className="font-semibold text-ink">
          This person&apos;s requests could not be loaded right now.
        </p>
        <p className="text-sm text-ink-muted">Try again in a moment.</p>
      </div>
      <ButtonLink href={retryHref} prefetch={false}>
        Try again
      </ButtonLink>
    </CenteredCard>
  );
}

/** The filters match nothing. */
export function NoMatches({ clearHref }: { clearHref: string }) {
  return (
    <CenteredCard icon="/icons/clipboard-list.svg" tint="bg-brand-50">
      <p className="font-semibold text-ink">No requests match these filters.</p>
      <ButtonLink href={clearHref} variant="secondary" prefetch={false}>
        Clear filters
      </ButtonLink>
    </CenteredCard>
  );
}

/** The page number is past the last page. */
export function PageOutOfRange({ firstPageHref }: { firstPageHref: string }) {
  return (
    <CenteredCard icon="/icons/clipboard-list.svg" tint="bg-brand-50">
      <p className="font-semibold text-ink">There are no requests on this page.</p>
      <ButtonLink href={firstPageHref} variant="secondary" prefetch={false}>
        Go to the first page
      </ButtonLink>
    </CenteredCard>
  );
}
