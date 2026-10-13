import type { Metadata } from "next";
import { logoutAction } from "@/app/login/actions";
import { requireSession } from "@/lib/auth/guards";
import type { UserRole } from "@/lib/db/types";

export const metadata: Metadata = { title: "Dashboard" };

const ROLE_LABEL: Record<UserRole, string> = {
  employee: "Employee",
  manager: "Manager",
  hr_admin: "HR Admin",
};

/** Post-login landing. Role-specific content (balance, approvals, audit) arrives with Day 1 tasks. */
export default async function DashboardPage() {
  const { user, role } = await requireSession();

  return (
    <main>
      <h1>Dashboard</h1>
      <p>
        Signed in as <strong>{user.name}</strong> ({ROLE_LABEL[role]})
      </p>
      <form action={logoutAction}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
