import { describe, expect, it } from "vitest";
import { verifyCronSecret } from "@/lib/auth/cron";

const SECRET = "s".repeat(64);

describe("verifyCronSecret", () => {
  it("accepts the exact bearer secret", () => {
    expect(verifyCronSecret(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it.each([null, "", SECRET, `Bearer ${SECRET}x`, `Bearer ${SECRET.slice(1)}`, `Basic ${SECRET}`])(
    "rejects %j",
    (header) => {
      expect(verifyCronSecret(header, SECRET)).toBe(false);
    },
  );

  it("fails closed when no secret is configured", () => {
    expect(verifyCronSecret("Bearer ", undefined)).toBe(false);
    expect(verifyCronSecret("Bearer anything", undefined)).toBe(false);
  });
});
