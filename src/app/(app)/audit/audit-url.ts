import { AUDIT_STATUSES, type AuditListQuery, type AuditListStatus } from "@/lib/leave/schemas";

import { formatDay } from "./audit-format";

const BASE = "/audit";

/** The address of the audit list for a set of filters and a page. Only non-default values are written. */
export function auditHref(query: AuditListQuery, page = 1): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.leaveTypeId) params.set("type", query.leaveTypeId);
  if (query.status) params.set("status", query.status);
  if (query.decidedBy) params.set("by", query.decidedBy);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `${BASE}${qs ? `?${qs}` : ""}`;
}

/** The values chosen in the filter form. An empty string means "no filter". */
export type AuditFilterValues = {
  q: string;
  type: string;
  status: string;
  by: string;
  from: string;
  to: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The address for the values chosen in the form (always page 1). Anything odd falls back to "no
 * filter"; the page checks every value again on the server, so this never has to be trusted.
 */
export function filtersHref(values: AuditFilterValues): string {
  const status = (AUDIT_STATUSES as readonly string[]).includes(values.status)
    ? (values.status as AuditListStatus)
    : undefined;
  return auditHref({
    q: values.q.trim() || undefined,
    leaveTypeId: values.type || undefined,
    status,
    decidedBy: values.by || undefined,
    from: DATE.test(values.from) ? values.from : undefined,
    to: DATE.test(values.to) ? values.to : undefined,
    page: 1,
  });
}

export type AuditChip = {
  key: "q" | "type" | "status" | "by" | "from" | "to";
  label: string;
  removeHref: string;
};

export const STATUS_LABEL: Record<AuditListStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  deleted: "Removed (soft-deleted)",
};

/** One chip per applied filter, each with the address that removes just that filter. */
export function filterChips(
  query: AuditListQuery,
  choices: {
    leaveTypes: readonly { id: string; name: string }[];
    deciders: readonly { id: string; name: string }[];
  },
): AuditChip[] {
  const without = (patch: Partial<AuditListQuery>) => auditHref({ ...query, ...patch, page: 1 });
  const chips: AuditChip[] = [];
  if (query.q)
    chips.push({ key: "q", label: `Search: ${query.q}`, removeHref: without({ q: undefined }) });
  if (query.leaveTypeId) {
    const name = choices.leaveTypes.find((t) => t.id === query.leaveTypeId)?.name ?? "Unknown";
    chips.push({
      key: "type",
      label: `Leave type: ${name}`,
      removeHref: without({ leaveTypeId: undefined }),
    });
  }
  if (query.status)
    chips.push({
      key: "status",
      label: `Status: ${STATUS_LABEL[query.status]}`,
      removeHref: without({ status: undefined }),
    });
  if (query.decidedBy) {
    const name = choices.deciders.find((d) => d.id === query.decidedBy)?.name ?? "Unknown";
    chips.push({
      key: "by",
      label: `Decided by: ${name}`,
      removeHref: without({ decidedBy: undefined }),
    });
  }
  if (query.from)
    chips.push({
      key: "from",
      label: `From: ${formatDay(query.from)}`,
      removeHref: without({ from: undefined }),
    });
  if (query.to)
    chips.push({
      key: "to",
      label: `To: ${formatDay(query.to)}`,
      removeHref: without({ to: undefined }),
    });
  return chips;
}
