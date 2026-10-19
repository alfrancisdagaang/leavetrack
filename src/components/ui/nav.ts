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
  description: "Review leave requests and see your direct reports.",
  available: true,
};

const OVERRIDES: NavItem = {
  key: "overrides",
  label: "HR Overrides",
  href: "/approvals/overrides",
  description: "Decide leave requests that ask for more days than the balance.",
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
  if (role === "hr_admin") items.push(OVERRIDES, AUDIT);
  return items;
}

/**
 * The item for the current page: the one with the longest matching href. A longer href can sit
 * under a shorter one (/approvals/overrides under /approvals), and the longer one must win, both
 * for the highlight and for the top bar title.
 */
export function currentNavItem(items: readonly NavItem[], pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const item of items) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
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
