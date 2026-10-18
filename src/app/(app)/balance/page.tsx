import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingRegion } from "@/components/ui/skeleton";
import { requireSession } from "@/lib/auth/guards";
import { getEnv } from "@/lib/env";
import { todayIn } from "@/lib/leave/calendar-layout";
import { BalanceSection } from "./balance-section";
import { BalanceBodySkeleton } from "./balance-skeleton";

export const metadata: Metadata = { title: "My balance" };
export const dynamic = "force-dynamic";

/** US-02. The header shows at once; the balances and the request list stream in below it. */
export default async function BalancePage() {
  const { user } = await requireSession();
  const today = todayIn(getEnv().APP_TIMEZONE ?? "UTC", new Date());

  return (
    <div>
      <PageHeader
        title="My balance"
        description="Pending requests are not deducted until approved."
        action={
          <ButtonLink href="/requests/new" prefetch={false}>
            <Image src="/icons/plus.svg" alt="" width={20} height={20} unoptimized />
            Request leave
          </ButtonLink>
        }
      />
      <Suspense
        fallback={
          <LoadingRegion>
            <BalanceBodySkeleton />
          </LoadingRegion>
        }
      >
        <BalanceSection userId={user.id} today={today} />
      </Suspense>
    </div>
  );
}
