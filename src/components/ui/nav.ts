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

const TEAM: NavItem = {
  key: "team",
  label: "My Team",
  href: "/approvals/team",
  description: "See your direct reports and their leave.",
  available: true,
};

const OVERRIDES: NavItem = {
  key: "overrides",
  label: "Balance Overrides",
  href: "/approvals/overrides",
  description: "Decide leave requests that ask for more days than the balance.",
  available: true,
};

const CALENDAR: NavItem = {
  key: "calendar",
  label: "Calendar",
  href: "/calendar",
  description: "See how many people are out each day, company-wide.",
  available: true,
};

const PROFILE: NavItem = {
  key: "profile",
  label: "My Profile",
  href: "/profile",
  description: "Your profile, your place in the organization and your account.",
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
 * Navigation per role (EPIC-10). Only employees request leave and see a balance; only managers
 * have Team Approvals and My Team; HR admins get Balance Overrides, the company Calendar and Audit History.
 * Every role ends with My Profile (EPIC-11): it is each person's own page, so it is not role-gated.
 * This only decides what is shown — access is enforced by requireRole()/assertRole() and SQL.
 */
export function navItemsFor(role: UserRole): NavItem[] {
  if (role === "employee") return [DASHBOARD, REQUEST, BALANCE, PROFILE];
  if (role === "manager") return [DASHBOARD, APPROVALS, TEAM, PROFILE];
  return [DASHBOARD, OVERRIDES, CALENDAR, AUDIT, PROFILE];
}

/**
 * The item for the current page: the one with the longest matching href. A longer href can sit
 * under a shorter one (/approvals/team and /approvals/overrides under /approvals), and the longer one must win, both
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

/**
 * The top bar title: the current nav item's label. My Profile and its sub-pages (/profile/organization,
 * /profile/settings) are all one nav item, and are titled "My Profile" here explicitly so a sub-page
 * can never fall back to a different label.
 */
export function pageTitleFor(items: readonly NavItem[], pathname: string): string {
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return "My Profile";
  return currentNavItem(items, pathname)?.label ?? "LeaveTrack";
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
