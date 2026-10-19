/**
 * Row types mirroring supabase/migrations/20261013000000_init_leave_domain.sql.
 * Keep in lockstep with the migrations — a schema change updates both in the same PR.
 * numeric columns are strings: postgres.js returns numeric as string to avoid float loss.
 */

export const USER_ROLES = ["employee", "manager", "hr_admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LEAVE_STATUSES = ["pending", "approved", "rejected"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const AUDIT_ACTIONS = [
  "submitted",
  "approved",
  "rejected",
  "soft_deleted",
  "override_approved",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  manager_id: string | null;
};

export type LeaveType = {
  id: string;
  name: string;
  tracks_balance: boolean;
};

export type LeavePolicy = {
  id: string;
  user_id: string;
  leave_type_id: string;
  accrual_per_month: string;
};

export type LeaveBalance = {
  id: string;
  user_id: string;
  leave_type_id: string;
  balance: string;
  updated_at: Date;
};

export type LeaveRequest = {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  decided_by: string | null;
  decided_at: Date | null;
  /** Required when rejected (enforced by leave_requests_rejection_note); null for approvals. */
  decision_note: string | null;
  is_deleted: boolean;
  created_at: Date;
};

export type AuditLogEntry = {
  id: string;
  leave_request_id: string;
  actor_id: string;
  action: AuditAction;
  occurred_at: Date;
  /**
   * The three figures below are set exactly on `override_approved` rows (enforced by
   * audit_log_shortfall_consistent) and null on every other action.
   */
  days_requested: string | null;
  balance_before: string | null;
  shortfall: string | null;
};

export type AccrualLedgerEntry = {
  id: string;
  user_id: string;
  leave_type_id: string;
  /** First day of the accrued month (UTC), as YYYY-MM-DD. */
  period: string;
  amount: string;
  created_at: Date;
};
