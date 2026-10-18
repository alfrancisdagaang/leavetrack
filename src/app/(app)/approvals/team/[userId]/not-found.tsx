import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * The one answer for a person the manager cannot open: another team's member, someone who does not
 * exist, someone deleted, themselves, or a malformed address. It says nothing that tells those apart
 * (US-13 AC7, BR-02), so an address cannot be probed to find out who exists.
 */
export default function TeamMemberNotFound() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-brand-50"
        >
          <Image src="/icons/users-card.svg" alt="" width={24} height={24} unoptimized />
        </span>
        <p className="font-semibold text-ink">We couldn&apos;t find that person on your team.</p>
        <ButtonLink href="/approvals/team" prefetch={false}>
          Back to My team
        </ButtonLink>
      </div>
    </Card>
  );
}
