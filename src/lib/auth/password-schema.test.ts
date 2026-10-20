import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/password-schema";

const ok = {
  current_password: "old-pass-1",
  new_password: "new-pass-22",
  confirm_password: "new-pass-22",
};
const messages = (input: unknown) => {
  const r = changePasswordSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("changePasswordSchema (TASK-065 AC2)", () => {
  it("accepts a valid body, and keeps spaces in a password", () => {
    expect(changePasswordSchema.safeParse(ok).success).toBe(true);
    const spaced = { ...ok, new_password: "  spaced out  ", confirm_password: "  spaced out  " };
    const parsed = changePasswordSchema.parse(spaced);
    expect(parsed.new_password).toBe("  spaced out  ");
  });

  it("rejects a new password under the minimum and over the maximum", () => {
    const short = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    expect(messages({ ...ok, new_password: short, confirm_password: short })).toEqual([
      expect.stringContaining("new_password: New password must be at least 8"),
    ]);
    const edge = "b".repeat(PASSWORD_MIN_LENGTH);
    expect(
      changePasswordSchema.safeParse({ ...ok, new_password: edge, confirm_password: edge }).success,
    ).toBe(true);
    const long = "c".repeat(PASSWORD_MAX_LENGTH + 1);
    expect(messages({ ...ok, new_password: long, confirm_password: long })[0]).toContain(
      "at most 72",
    );
    const max = "d".repeat(PASSWORD_MAX_LENGTH);
    expect(
      changePasswordSchema.safeParse({ ...ok, new_password: max, confirm_password: max }).success,
    ).toBe(true);
  });

  it("rejects a confirmation that does not match", () => {
    expect(messages({ ...ok, confirm_password: "different-1" })).toEqual([
      expect.stringContaining("confirm_password: The confirmation does not match"),
    ]);
  });

  it("rejects a new password equal to the current one", () => {
    const same = {
      current_password: "same-pass-1",
      new_password: "same-pass-1",
      confirm_password: "same-pass-1",
    };
    expect(messages(same)).toEqual([expect.stringContaining("different from the current one")]);
  });

  it("rejects a missing current password and a non-object body", () => {
    expect(messages({ ...ok, current_password: "" })[0]).toContain("current_password");
    expect(changePasswordSchema.safeParse(null).success).toBe(false);
    expect(changePasswordSchema.safeParse("x").success).toBe(false);
  });

  it("never puts a submitted password in a message", () => {
    const text = messages({
      current_password: "TopSecret-Cur",
      new_password: "TopSecret-New",
      confirm_password: "TopSecret-Bad",
    }).join(" ");
    expect(text).not.toContain("TopSecret");
  });
});
