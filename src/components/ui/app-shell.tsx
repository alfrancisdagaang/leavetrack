import { Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { UserRole } from "@/lib/db/types";
import { initialsOf } from "@/components/ui/initials";
import { HeaderMenu } from "@/components/ui/header-menu";
import { MainNav } from "@/components/ui/main-nav";
import type { NavItem } from "@/components/ui/nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const ROLE_LABEL: Record<UserRole, string> = {
  employee: "Employee",
  manager: "Manager",
  hr_admin: "HR Admin",
};

interface AppShellProps {
  userName: string;
  role: UserRole;
  items: NavItem[];
  signOutAction: () => Promise<void>;
  children: ReactNode;
}

/**
 * Chrome for signed-in pages: skip link, navy header with the logo, role-aware navigation, the
 * signed-in user and sign-out. The header wraps on small screens, so nothing needs horizontal
 * scroll at 375px.
 */
export function AppShell({ userName, role, items, signOutAction, children }: AppShellProps) {
  return (
    <div className={`${inter.variable} min-h-dvh bg-page font-sans`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-navy-900"
      >
        Skip to content
      </a>
      <header className="bg-nav text-white">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-3 sm:px-8 lg:min-h-[86px] lg:py-0 lg:pl-20 lg:pr-12">
          <Link href="/dashboard" className="flex min-h-11 items-center gap-3.5 text-2xl font-bold">
            <Image src="/icons/leaf-logo.svg" alt="" width={36} height={32} unoptimized />
            LeaveTrack
          </Link>
          <HeaderMenu>
            <MainNav items={items} />
            <div className="flex flex-col gap-3 pb-2 lg:flex-row lg:items-center lg:gap-5 lg:pb-0">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-avatar text-[17px] font-semibold"
                >
                  {initialsOf(userName)}
                </span>
                <div className="leading-tight">
                  <p className="text-[17px] font-semibold">{userName}</p>
                  <p className="mt-1 text-sm text-nav-muted">{ROLE_LABEL[role]}</p>
                </div>
              </div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-nav-border px-3.5 py-2.5 text-[15px] lg:w-auto font-medium text-nav-muted transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Image src="/icons/log-out.svg" alt="" width={20} height={20} unoptimized />
                  Sign out
                </button>
              </form>
            </div>
          </HeaderMenu>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
