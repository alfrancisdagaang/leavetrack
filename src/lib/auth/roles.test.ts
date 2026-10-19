import { describe, expect, it } from "vitest";
import { canApproveLeave, canRequestLeave } from "@/lib/auth/roles";

describe("canRequestLeave (EPIC-10)", () => {
  it("allows employees only", () => {
    expect(canRequestLeave("employee")).toBe(true);
    expect(canRequestLeave("manager")).toBe(false);
    expect(canRequestLeave("hr_admin")).toBe(false);
  });
});

describe("canApproveLeave (EPIC-10, TASK-059)", () => {
  it("allows managers only: an HR admin has no team and no normal approvals", () => {
    expect(canApproveLeave("manager")).toBe(true);
    expect(canApproveLeave("hr_admin")).toBe(false);
    expect(canApproveLeave("employee")).toBe(false);
  });
});
