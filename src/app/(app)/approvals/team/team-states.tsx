import Image from "next/image";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** A centred card with a tinted icon, shared by the team pages' states. */
export function CenteredCard({
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

/** The roster could not be read: say so, and offer a way to try again. */
export function TeamError() {
  return (
    <CenteredCard icon="/icons/circle-alert.svg" tint="bg-rejected-bg">
      <div role="alert" className="space-y-1">
        <p className="font-semibold text-ink">Your team could not be loaded right now.</p>
        <p className="text-sm text-ink-muted">Try again in a moment.</p>
      </div>
      <ButtonLink href="/approvals/team" prefetch={false}>
        Try again
      </ButtonLink>
    </CenteredCard>
  );
}

/** The signed-in manager has no direct reports (US-12 AC3). */
export function TeamEmpty() {
  return (
    <CenteredCard icon="/icons/users-card.svg" tint="bg-brand-50">
      <p className="font-semibold text-ink">You have no direct reports yet.</p>
    </CenteredCard>
  );
}
