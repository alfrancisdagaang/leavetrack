import type { UserRole } from "@/lib/db/types";

/**
 * EPIC-10: only Employees request leave and hold a balance. Managers approve their direct
 * reports' requests and HR Admins run overrides and audits; neither has leave requests of their own.
 * One definition for the route, the pages, the dashboard and the navigation.
 */
export function canRequestLeave(role: UserRole): boolean {
  return role === "employee";
}

/** The message for a manager or HR admin who tries to request leave or read leave balances. */
export const EMPLOYEES_ONLY_MESSAGE =
  "Only employees can request leave. Managers and HR admins don't have leave requests in LeaveTrack.";

/**
 * EPIC-10 (TASK-059): only Managers approve or reject normal requests, and only for their direct
 * reports (the scope is in SQL). HR Admins have no team; they decide over-balance requests
 * through the HR override instead.
 */
export function canApproveLeave(role: UserRole): boolean {
  return role === "manager";
}

/** The message for anyone but a manager who tries to approve or reject a request. */
export const APPROVERS_ONLY_MESSAGE =
  "Only managers can approve or reject a request. HR admins decide over-balance requests from Balance Overrides.";
