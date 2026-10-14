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
  label: "Request leave",
  href: "/requests/new",
  description: "Submit a leave request for your manager to review.",
  available: true,
};

const BALANCE: NavItem = {
  key: "balance",
  label: "My balance",
  href: "/balance",
  description: "See your confirmed and pending leave days.",
  available: true,
};

const APPROVALS: NavItem = {
  key: "approvals",
  label: "Team approvals",
  href: "/approvals",
  description: "Review leave requests from your direct reports.",
  available: true,
};

const AUDIT: NavItem = {
  key: "audit",
  label: "Audit log",
  href: "/audit",
  description: "Browse the decision record for the last three years.",
  available: false,
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
