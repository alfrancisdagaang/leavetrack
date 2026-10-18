import type { BadgeVariant } from "@/components/ui/badge";
import type { LeaveStatus, UserRole } from "@/lib/db/types";
import { formatDateRange } from "@/lib/leave/format";
import type { RosterStatus } from "@/lib/leave/team-roster";

/** "1 day", "8 days", "11.25 days", "−3 days". Amounts are shown as stored (up to 2 decimals). */
export function formatDays(n: number): string {
  const abs = Math.abs(n);
  const text = `${abs} day${abs === 1 ? "" : "s"}`;
  return n < 0 ? `−${text}` : text;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  employee: "Employee",
  manager: "Manager",
  hr_admin: "HR Admin",
};

/** Status is always written out, never colour alone. */
export const STATUS_BADGE: Record<LeaveStatus, { variant: BadgeVariant; label: string }> = {
  pending: { variant: "pending", label: "Pending" },
  approved: { variant: "approved", label: "Approved" },
  rejected: { variant: "rejected", label: "Rejected" },
};

/** The line under a person's name on the roster (US-12 AC2): written as text, from approved leave. */
export function rosterStatusText(status: RosterStatus): string {
  if (status.kind === "out_today") return "Out today";
  if (status.kind === "next_leave")
    return `Next leave: ${formatDateRange(status.start, status.start)}`;
  return "No leave planned";
}
