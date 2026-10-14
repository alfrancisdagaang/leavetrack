import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { navItemsFor } from "@/components/ui/nav";
import { CARD_ICON } from "@/components/ui/nav-icons";
import { requireSession } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";
import { requireDb } from "@/lib/leave/service";
import { getTeamQueue } from "@/lib/leave/team";

export const metadata: Metadata = { title: "Dashboard" };

/** Pending requests from the signed-in manager's own reports (scoped in SQL). Null if unavailable. */
async function pendingApprovalCount(managerId: string): Promise<number | null> {
  try {
    return (await getTeamQueue(requireDb(), managerId)).length;
  } catch (err) {
    logger.warn({ err }, "dashboard: pending approval count unavailable");
    return null;
  }
}

/** Post-login landing. One role-aware dashboard; each card becomes live as its task ships. */
export default async function DashboardPage() {
  const { user, role } = await requireSession();
  const cards = navItemsFor(role).filter((item) => item.key !== "dashboard");
  const pending =
    role === "manager" || role === "hr_admin" ? await pendingApprovalCount(user.id) : null;

  return (
    <div className="relative left-1/2 w-[min(1352px,calc(100vw-4rem))] -translate-x-1/2 max-sm:w-full max-sm:left-0 max-sm:translate-x-0">
      <header className="pb-6 pt-4 sm:pt-10">
        <p className="text-lg font-medium text-ink-muted sm:text-xl">Welcome back,</p>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-[38px] sm:leading-[46px]">
          {user.name}
        </h1>
        <p className="mt-2 text-base text-ink-muted sm:text-xl">
          Here&apos;s an overview of your leave management, approvals, and team requests.
        </p>
      </header>
      <div className="grid gap-4 xl:grid-cols-2 xl:gap-[26px]">
        {cards.map((item) => {
          const icon = CARD_ICON[item.key] ?? "/icons/card-calendar.svg";
          const primary = item.key !== "balance" && item.key !== "audit";
          const showPending = item.key === "approvals" && pending !== null && pending > 0;
          const pendingBadge = (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-warn-bg px-2.5 text-[13px] text-warn-fg">
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warn-dot px-1.5 font-bold text-white">
                {pending}
              </span>
              Pending approvals
            </span>
          );
          return (
            <section
              key={item.key}
              className="relative flex gap-4 rounded-tile bg-white px-5 py-6 shadow-tile sm:gap-8 sm:px-8"
            >
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-50 sm:h-20 sm:w-[82px]">
                <Image src={icon} alt="" width={48} height={48} unoptimized />
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
                <h2 className="text-2xl font-bold text-ink">{item.label}</h2>
                <p className="text-base text-ink-muted sm:text-xl sm:leading-[30px]">
                  {item.description}
                </p>
                {showPending ? <span className="sm:hidden">{pendingBadge}</span> : null}
                {item.available ? (
                  <Link
                    href={item.href}
                    className={`inline-flex min-h-[54px] items-center justify-center gap-3 rounded-lg border border-brand-500 px-7 text-[19px] font-medium transition-colors ${
                      primary
                        ? "bg-brand-500 text-white hover:bg-brand-600"
                        : "bg-white text-brand-500 hover:bg-brand-50"
                    }`}
                  >
                    {primary ? (
                      <Image src="/icons/plus.svg" alt="" width={18} height={18} unoptimized />
                    ) : null}
                    Open
                    <span className="sr-only"> {item.label}</span>
                  </Link>
                ) : (
                  <Badge>Coming soon</Badge>
                )}
              </div>
              {item.available ? (
                <Image
                  src="/icons/arrow-right.svg"
                  alt=""
                  width={22}
                  height={22}
                  unoptimized
                  className={`absolute right-8 hidden sm:block ${item.key === "approvals" ? "bottom-[42px]" : "top-11"}`}
                />
              ) : null}
              {showPending ? (
                <span className="absolute right-6 top-[30px] hidden sm:block">{pendingBadge}</span>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
