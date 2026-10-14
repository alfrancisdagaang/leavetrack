import { describe, expect, it } from "vitest";
import {
  createLeaveRequestSchema,
  decisionSchema,
  listQuerySchema,
  requestIdSchema,
} from "@/lib/leave/schemas";

const TYPE_ID = "10000000-0000-4000-8000-000000000001";
const valid = { leave_type_id: TYPE_ID, start_date: "2026-10-20", end_date: "2026-10-22" };

describe("createLeaveRequestSchema", () => {
  it("accepts a valid request and defaults the reason to an empty string", () => {
    const parsed = createLeaveRequestSchema.parse(valid);
    expect(parsed.reason).toBe("");
  });

  it("US-01 AC2: rejects an end date before the start date", () => {
    const result = createLeaveRequestSchema.safeParse({
      ...valid,
      start_date: "2026-10-22",
      end_date: "2026-10-20",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["end_date"]);
  });

  it("accepts a same-day request", () => {
    expect(
      createLeaveRequestSchema.safeParse({
        ...valid,
        start_date: "2026-10-20",
        end_date: "2026-10-20",
      }).success,
    ).toBe(true);
  });

  it("rejects a range with no working days", () => {
    const result = createLeaveRequestSchema.safeParse({
      ...valid,
      start_date: "2026-10-17",
      end_date: "2026-10-18",
    });
    expect(result.success).toBe(false);
  });

  it("rejects impossible calendar dates and a malformed leave type id", () => {
    expect(createLeaveRequestSchema.safeParse({ ...valid, start_date: "2026-02-30" }).success).toBe(
      false,
    );
    expect(
      createLeaveRequestSchema.safeParse({ ...valid, leave_type_id: "vacation" }).success,
    ).toBe(false);
  });

  it("rejects an over-long reason", () => {
    expect(createLeaveRequestSchema.safeParse({ ...valid, reason: "x".repeat(501) }).success).toBe(
      false,
    );
  });

  it("strips a client-supplied user id", () => {
    const parsed = createLeaveRequestSchema.parse({ ...valid, user_id: "someone-else" });
    expect(parsed).not.toHaveProperty("user_id");
  });
});

describe("listQuerySchema", () => {
  it("defaults to scope=mine, accepts team, and rejects anything else", () => {
    expect(listQuerySchema.parse({}).scope).toBe("mine");
    expect(listQuerySchema.parse({ scope: "team" }).scope).toBe("team");
    expect(listQuerySchema.safeParse({ scope: "all" }).success).toBe(false);
  });
});

describe("decisionSchema", () => {
  it("accepts an approval without a note", () => {
    expect(decisionSchema.parse({ decision: "approve" })).toEqual({ decision: "approve" });
  });

  it("US-03 AC2: a rejection requires a non-blank reason", () => {
    expect(decisionSchema.safeParse({ decision: "reject" }).success).toBe(false);
    expect(decisionSchema.safeParse({ decision: "reject", note: "   " }).success).toBe(false);
    expect(decisionSchema.parse({ decision: "reject", note: " Team is short " })).toEqual({
      decision: "reject",
      note: "Team is short",
    });
  });

  it("caps the note at 500 characters and rejects unknown decisions", () => {
    expect(decisionSchema.safeParse({ decision: "reject", note: "x".repeat(501) }).success).toBe(
      false,
    );
    expect(decisionSchema.safeParse({ decision: "delete" }).success).toBe(false);
  });

  it("strips fields a client must not control (decided_by, status)", () => {
    const parsed = decisionSchema.parse({
      decision: "approve",
      decided_by: "x",
      status: "approved",
    });
    expect(parsed).toEqual({ decision: "approve" });
  });
});

describe("requestIdSchema", () => {
  it("accepts a uuid and rejects anything else", () => {
    expect(requestIdSchema.safeParse(TYPE_ID).success).toBe(true);
    expect(requestIdSchema.safeParse("1; drop table").success).toBe(false);
  });
});
