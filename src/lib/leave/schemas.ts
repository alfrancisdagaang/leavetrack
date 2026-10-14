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
