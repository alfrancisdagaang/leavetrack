import { z } from "zod";
import { countWorkingDays, isRealIsoDate } from "@/lib/leave/working-days";

const isoDate = z.string().refine(isRealIsoDate, "must be a real date written as YYYY-MM-DD");

/**
 * POST /api/leave-requests body. Unknown keys (e.g. a client-sent user_id) are stripped:
 * the requester is always the session user.
 */
export const createLeaveRequestSchema = z
  .object({
    leave_type_id: z.uuid(),
    start_date: isoDate,
    end_date: isoDate,
    reason: z.string().trim().max(500).default(""),
  })
  .superRefine((value, ctx) => {
    // US-01 AC2. The DB check constraint is the backstop; this gives a clean validation error.
    if (value.end_date < value.start_date) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "must not be before the start date",
      });
      return;
    }
    if (countWorkingDays(value.start_date, value.end_date) === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "the range contains no working days (Mon-Fri)",
      });
    }
  });

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

/** GET /api/leave-requests query. `team` is the manager queue (TASK-013). */
export const listQuerySchema = z.object({
  scope: z.enum(["mine", "team"]).default("mine"),
});

/** POST /api/leave-requests/:id/decision body. A rejection must carry a reason (US-03 AC2). */
export const decisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve") }),
  z.object({
    decision: z.literal("reject"),
    note: z.string().trim().min(1, "a reason is required to reject").max(500),
  }),
]);

export type DecisionInput = z.infer<typeof decisionSchema>;

export const requestIdSchema = z.uuid();

/** An optional YYYY-MM-DD query value; an empty form field counts as "not set". */
const optionalDate = z.preprocess((v) => (v === "" ? undefined : v), isoDate.optional());

/**
 * GET /api/audit/:userId query (US-05). `from`/`to` are UTC calendar days (inclusive); a request
 * matches when any of its audit events falls inside the range. Soft-deleted requests are hidden
 * unless `include_deleted=true`.
 */
export const auditQuerySchema = z
  .object({
    from: optionalDate,
    to: optionalDate,
    include_deleted: z
      .preprocess((v) => (v === "" ? undefined : v), z.enum(["true", "false"]).optional())
      .transform((v) => v === "true"),
  })
  .superRefine((value, ctx) => {
    if (value.from && value.to && value.to < value.from) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "must not be before the from date" });
    }
  });

export type AuditQuery = z.infer<typeof auditQuerySchema>;

/** The person in a team member page's address. Anything else is "not found", never an error. */
export const memberIdSchema = z.uuid();

/** US-13. A team member's requests are listed this many at a time. */
export const MEMBER_PAGE_SIZE = 25;
/** The highest page number accepted from the address (a guard on the offset, not a data limit). */
export const MEMBER_MAX_PAGE = 1000;

export type TeamMemberQuery = {
  /** Only this leave type; undefined means all. */
  leaveTypeId: string | undefined;
  /** Only this status; undefined means all. */
  status: "pending" | "approved" | "rejected" | undefined;
  /** The calendar year: the current one, or one of the two before it (3-year retention). */
  year: number;
  page: number;
};

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/**
 * US-13 AC2 and AC3. Reads the filters of a team member's page from the page address. Every value is
 * checked on its own: a bad one is dropped (and named in `ignored`) so the page shows its default for
 * it and never fails; the others still apply. An empty value ("All") means no filter.
 */
export function parseTeamMemberQuery(
  params: Record<string, string | string[] | undefined>,
  currentYear: number,
): { query: TeamMemberQuery; ignored: string[] } {
  const ignored: string[] = [];
  const raw = (key: string) => {
    const value = first(params[key]);
    return value === undefined || value === "" ? undefined : value;
  };

  let leaveTypeId: TeamMemberQuery["leaveTypeId"];
  const type = raw("type");
  if (type !== undefined) {
    const parsed = z.uuid().safeParse(type);
    if (parsed.success) leaveTypeId = parsed.data;
    else ignored.push("leave type");
  }

  let status: TeamMemberQuery["status"];
  const statusValue = raw("status");
  if (statusValue !== undefined) {
    const parsed = z.enum(["pending", "approved", "rejected"]).safeParse(statusValue);
    if (parsed.success) status = parsed.data;
    else ignored.push("status");
  }

  let year = currentYear;
  const yearValue = raw("year");
  if (yearValue !== undefined) {
    const n = /^\d{4}$/.test(yearValue) ? Number(yearValue) : NaN;
    if (n >= currentYear - 2 && n <= currentYear) year = n;
    else ignored.push("year");
  }

  let page = 1;
  const pageValue = raw("page");
  if (pageValue !== undefined) {
    const n = /^\d{1,4}$/.test(pageValue) ? Number(pageValue) : NaN;
    if (n >= 1 && n <= MEMBER_MAX_PAGE) page = n;
    else ignored.push("page");
  }

  return { query: { leaveTypeId, status, year, page }, ignored };
}

/** US-14. The audit list shows this many requests at a time. */
export const AUDIT_PAGE_SIZE = 25;

export const AUDIT_STATUSES = ["pending", "approved", "rejected", "deleted"] as const;
export type AuditListStatus = (typeof AUDIT_STATUSES)[number];

export type AuditListQuery = {
  /** Part of the employee's name; undefined means everyone. */
  q: string | undefined;
  leaveTypeId: string | undefined;
  /** "deleted" is a soft-deleted request (whatever its status was); the others are live requests. */
  status: AuditListStatus | undefined;
  /** Only requests decided by this person. */
  decidedBy: string | undefined;
  /** UTC calendar days, inclusive: a request matches when any of its audit events falls inside. */
  from: string | undefined;
  to: string | undefined;
  page: number;
};

const AUDIT_SEARCH_MAX = 60;

/**
 * US-14. Reads the audit list filters from the page address. Every value is checked on its own: a bad
 * one is dropped (and named in `ignored`) so the page shows its default for it and never fails. An
 * empty value means no filter, and there is no default date range: nothing in the record is hidden.
 */
export function parseAuditListQuery(params: Record<string, string | string[] | undefined>): {
  query: AuditListQuery;
  ignored: string[];
} {
  const ignored: string[] = [];
  const raw = (key: string) => {
    const value = first(params[key]);
    return value === undefined || value === "" ? undefined : value;
  };

  let q: string | undefined;
  const search = raw("q")?.trim();
  if (search) {
    if (search.length <= AUDIT_SEARCH_MAX) q = search;
    else ignored.push("search");
  }

  const uuid = (key: string, label: string) => {
    const value = raw(key);
    if (value === undefined) return undefined;
    const parsed = z.uuid().safeParse(value);
    if (parsed.success) return parsed.data;
    ignored.push(label);
    return undefined;
  };
  const leaveTypeId = uuid("type", "leave type");
  const decidedBy = uuid("by", "decided by");

  let status: AuditListQuery["status"];
  const statusValue = raw("status");
  if (statusValue !== undefined) {
    const parsed = z.enum(AUDIT_STATUSES).safeParse(statusValue);
    if (parsed.success) status = parsed.data;
    else ignored.push("status");
  }

  const date = (key: string) => {
    const value = raw(key);
    if (value === undefined) return undefined;
    if (isRealIsoDate(value)) return value;
    ignored.push(key === "from" ? "from date" : "to date");
    return undefined;
  };
  const from = date("from");
  let to = date("to");
  if (from && to && to < from) {
    ignored.push("to date");
    to = undefined;
  }

  let page = 1;
  const pageValue = raw("page");
  if (pageValue !== undefined) {
    const n = /^\d{1,4}$/.test(pageValue) ? Number(pageValue) : NaN;
    if (n >= 1 && n <= MEMBER_MAX_PAGE) page = n;
    else ignored.push("page");
  }

  return { query: { q, leaveTypeId, status, decidedBy, from, to, page }, ignored };
}
