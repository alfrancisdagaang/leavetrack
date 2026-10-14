import Link from "next/link";
import type { ReactNode } from "react";
import type { UserRole } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NavItem } from "@/components/ui/nav";

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

const NAV_ITEM = "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium";

/**
 * Chrome for signed-in pages: skip link, navy header with the wordmark, role-aware navigation and
 * sign-out. Nav wraps on small screens, so nothing needs horizontal scroll at 375px.
 */
export function AppShell({ userName, role, items, signOutAction, children }: AppShellProps) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-navy-900"
      >
        Skip to content
      </a>
      <header className="bg-navy-900 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="text-xl font-semibold tracking-tight">
            leavetrack
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">{userName}</span>
            <Badge>{ROLE_LABEL[role]}</Badge>
            <form action={signOutAction}>
              <Button type="submit" variant="inverse">
                Sign out
              </Button>
            </form>
          </div>
        </div>
        <nav aria-label="Main" className="border-t border-white/10">
          <ul className="mx-auto flex max-w-5xl flex-wrap gap-1 px-2 py-1">
            {items.map((item) => (
              <li key={item.key}>
                {item.available ? (
                  <Link href={item.href} className={`${NAV_ITEM} text-white hover:bg-white/10`}>
                    {item.label}
                  </Link>
                ) : (
                  <span aria-disabled="true" className={`${NAV_ITEM} gap-1.5 text-white/60`}>
                    {item.label}
                    <span className="text-xs">(soon)</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
