import { describe, expect, it } from "vitest";
import {
  auditQuerySchema,
  createLeaveRequestSchema,
  decisionSchema,
  parseTeamMemberQuery,
  listQuerySchema,
  memberIdSchema,
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

describe("auditQuerySchema", () => {
  it("accepts no filters and defaults to hiding soft-deleted requests", () => {
    expect(auditQuerySchema.parse({})).toEqual({ include_deleted: false });
  });

  it("accepts a range and the include_deleted toggle", () => {
    expect(
      auditQuerySchema.parse({ from: "2026-10-01", to: "2026-10-31", include_deleted: "true" }),
    ).toEqual({ from: "2026-10-01", to: "2026-10-31", include_deleted: true });
    expect(auditQuerySchema.parse({ include_deleted: "false" }).include_deleted).toBe(false);
  });

  it("treats empty form fields as not set", () => {
    expect(auditQuerySchema.parse({ from: "", to: "", include_deleted: "" })).toEqual({
      include_deleted: false,
    });
  });

  it("accepts a single-day range", () => {
    expect(auditQuerySchema.safeParse({ from: "2026-10-14", to: "2026-10-14" }).success).toBe(true);
  });

  it("rejects a reversed range, impossible dates and an unknown toggle value", () => {
    expect(auditQuerySchema.safeParse({ from: "2026-10-31", to: "2026-10-01" }).success).toBe(
      false,
    );
    expect(auditQuerySchema.safeParse({ from: "2026-02-30" }).success).toBe(false);
    expect(auditQuerySchema.safeParse({ include_deleted: "yes" }).success).toBe(false);
  });
});

describe("parseTeamMemberQuery (US-13 AC2, AC3)", () => {
  const VAC = "10000000-0000-4000-8000-000000000001";

  it("uses the defaults when there is nothing in the address: all types, all statuses, this year, page 1", () => {
    expect(parseTeamMemberQuery({}, 2026)).toEqual({
      query: { leaveTypeId: undefined, status: undefined, year: 2026, page: 1 },
      ignored: [],
    });
  });

  it("reads each filter, and treats an empty value (All) as no filter", () => {
    const result = parseTeamMemberQuery(
      { type: VAC, status: "pending", year: "2025", page: "3" },
      2026,
    );
    expect(result.query).toEqual({ leaveTypeId: VAC, status: "pending", year: 2025, page: 3 });
    expect(
      parseTeamMemberQuery({ type: "", status: "", year: "", page: "" }, 2026).ignored,
    ).toEqual([]);
  });

  it("accepts this year and the two before it, and nothing else", () => {
    for (const year of ["2026", "2025", "2024"]) {
      expect(parseTeamMemberQuery({ year }, 2026).query.year).toBe(Number(year));
    }
    for (const year of ["2023", "2027", "20", "abc", "2025.5"]) {
      const result = parseTeamMemberQuery({ year }, 2026);
      expect(result.query.year).toBe(2026);
      expect(result.ignored).toEqual(["year"]);
    }
  });

  it("drops a bad value on its own and keeps the good ones (never an error)", () => {
    const result = parseTeamMemberQuery(
      { type: "not-a-uuid", status: "approved", year: "2025", page: "0" },
      2026,
    );
    expect(result.query).toEqual({
      leaveTypeId: undefined,
      status: "approved",
      year: 2025,
      page: 1,
    });
    expect(result.ignored).toEqual(["leave type", "page"]);
  });

  it("rejects a status that is not one of the three, an over-large page and a negative page", () => {
    expect(parseTeamMemberQuery({ status: "deleted" }, 2026).ignored).toEqual(["status"]);
    expect(parseTeamMemberQuery({ page: "1001" }, 2026).query.page).toBe(1);
    expect(parseTeamMemberQuery({ page: "1000" }, 2026).query.page).toBe(1000);
    expect(parseTeamMemberQuery({ page: "-2" }, 2026).ignored).toEqual(["page"]);
  });

  it("takes the first value when a parameter is repeated", () => {
    expect(parseTeamMemberQuery({ status: ["rejected", "pending"] }, 2026).query.status).toBe(
      "rejected",
    );
  });
});

describe("memberIdSchema (US-13 AC7)", () => {
  it("accepts a uuid and rejects anything else, so a malformed address is just 'not found'", () => {
    expect(memberIdSchema.safeParse("00000000-0000-4000-8000-000000000003").success).toBe(true);
    for (const bad of ["", "abc", "1", "../etc/passwd", "00000000-0000-4000-8000-00000000000g"]) {
      expect(memberIdSchema.safeParse(bad).success).toBe(false);
    }
  });
});
