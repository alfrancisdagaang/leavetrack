import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import type { UserRole } from "@/lib/db/types";
import { AppFrame } from "@/components/ui/app-frame";
import { workspaceLabel, type NavItem } from "@/components/ui/nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const ROLE_LABEL: Record<UserRole, string> = {
  employee: "Employee",
  manager: "Manager",
  hr_admin: "HR Admin",
};

interface AppShellProps {
  userName: string;
  email: string;
  role: UserRole;
  /** IANA zone (APP_TIMEZONE) for the bell's times. */
  timeZone: string;
  items: NavItem[];
  signOutAction: () => Promise<void>;
  children: ReactNode;
}

/**
 * Chrome for signed-in pages: the skip link, the Inter font and the sidebar + top bar frame.
 * Navigation items come from navItemsFor(role); the frame is a client component, the page is not.
 */
export function AppShell({
  userName,
  email,
  role,
  timeZone,
  items,
  signOutAction,
  children,
}: AppShellProps) {
  return (
    <div className={`${inter.variable} min-h-dvh bg-page font-sans`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <AppFrame
        role={role}
        timeZone={timeZone}
        userName={userName}
        email={email}
        roleLabel={ROLE_LABEL[role]}
        workspace={workspaceLabel(role)}
        items={items}
        signOutAction={signOutAction}
      >
        {children}
      </AppFrame>
    </div>
  );
}
