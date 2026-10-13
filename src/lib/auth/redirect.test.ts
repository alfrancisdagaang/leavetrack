import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/approvals?tab=pending")).toBe("/approvals?tab=pending");
  });

  it.each([
    undefined,
    42,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/login",
    "/login?next=/x",
  ])("falls back to /dashboard for %j", (next) => {
    expect(safeNextPath(next)).toBe("/dashboard");
  });
});
