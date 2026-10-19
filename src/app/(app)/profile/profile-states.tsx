import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** The Overview could not be read: say so, and offer a way to try again. */
export function OverviewError() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-rejected-bg"
        >
          <Image src="/icons/circle-alert.svg" alt="" width={24} height={24} unoptimized />
        </span>
        <div role="alert" className="space-y-1">
          <p className="font-semibold text-ink">Your profile could not be loaded right now.</p>
          <p className="text-sm text-ink-muted">Try again in a moment.</p>
        </div>
        <ButtonLink href="/profile" prefetch={false}>
          Try again
        </ButtonLink>
      </div>
    </Card>
  );
}

/** A tab whose content arrives in a later task of EPIC-11. */
export function ComingSoon({ what }: { what: string }) {
  return (
    <Card>
      <p className="text-ink-muted">{what} is not available yet.</p>
    </Card>
  );
}
