import type { UserRole } from "@/lib/db/types";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  description: string;
  /** False until the page exists; the shell then shows a "soon" label instead of a dead link. */
  available: boolean;
}

const DASHBOARD: NavItem = {
  key: "dashboard",
  label: "Dashboard",
  href: "/dashboard",
  description: "Your starting point.",
  available: true,
};

const REQUEST: NavItem = {
  key: "request",
  label: "Request Leave",
  href: "/requests/new",
  description: "Submit a leave request for your manager to review.",
  available: true,
};

const BALANCE: NavItem = {
  key: "balance",
  label: "My Balance",
  href: "/balance",
  description: "See your confirmed and pending leave days.",
  available: true,
};

const APPROVALS: NavItem = {
  key: "approvals",
  label: "Team Approvals",
  href: "/approvals",
  description: "Review leave requests from your direct reports.",
  available: true,
};

const AUDIT: NavItem = {
  key: "audit",
  label: "Audit History",
  href: "/audit",
  description: "Browse the decision record for the last three years.",
  available: true,
};

/**
 * Navigation per role. Roles stack: managers and HR admins can also request leave.
 * This only decides what is shown — access is enforced by requireRole()/assertRole() and SQL.
 */
export function navItemsFor(role: UserRole): NavItem[] {
  const items = [DASHBOARD, REQUEST, BALANCE];
  if (role === "manager" || role === "hr_admin") items.push(APPROVALS);
  if (role === "hr_admin") items.push(AUDIT);
  return items;
}

const WORKSPACE_LABEL: Record<UserRole, string> = {
  employee: "Employee workspace",
  manager: "Manager workspace",
  hr_admin: "HR Admin workspace",
};

/** Small caption above the navigation (shown upper-cased by the sidebar). */
export function workspaceLabel(role: UserRole): string {
  return WORKSPACE_LABEL[role];
}
