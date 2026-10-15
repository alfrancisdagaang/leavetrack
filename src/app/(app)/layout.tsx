import type { ReactNode } from "react";
import { logoutAction } from "@/app/login/actions";
import { AppShell } from "@/components/ui/app-shell";
import { navItemsFor } from "@/components/ui/nav";
import { requireSession } from "@/lib/auth/guards";

/**
 * Chrome for signed-in pages. A layout is NOT a security boundary (it does not re-run on every
 * client navigation), so every page under here still calls requireSession()/requireRole() itself.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, role } = await requireSession();

  return (
    <AppShell
      userName={user.name}
      email={user.email}
      role={role}
      items={navItemsFor(role)}
      signOutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
