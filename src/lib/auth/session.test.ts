import { describe, expect, it } from "vitest";
import { parseRole, SESSION_MAX_AGE_SECONDS, sessionCookieOptions } from "@/lib/auth/session";

describe("parseRole", () => {
  it.each(["employee", "manager", "hr_admin"])("accepts %s", (role) => {
    expect(parseRole(role)).toBe(role);
  });

  it.each([undefined, "", "admin", "HR_ADMIN", "manager "])("rejects %j", (value) => {
    expect(parseRole(value)).toBeNull();
  });
});

describe("sessionCookieOptions", () => {
  it("is httpOnly, lax, 8h", () => {
    const opts = sessionCookieOptions("development");
    expect(opts).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(SESSION_MAX_AGE_SECONDS).toBe(8 * 60 * 60);
    expect(opts.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("is Secure outside local development", () => {
    expect(sessionCookieOptions("development", "development").secure).toBe(false);
    expect(sessionCookieOptions("staging", "production").secure).toBe(true);
    expect(sessionCookieOptions("production", "production").secure).toBe(true);
  });

  it("is Secure in a production build even when APP_ENV is left unset", () => {
    expect(sessionCookieOptions("development", "production").secure).toBe(true);
  });
});
