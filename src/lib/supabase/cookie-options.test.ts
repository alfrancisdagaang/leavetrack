import { describe, expect, it } from "vitest";
import { isSecureCookie, supabaseCookieOptions } from "@/lib/supabase/cookie-options";

describe("isSecureCookie", () => {
  it("is Secure on staging and production", () => {
    expect(isSecureCookie("staging", "production")).toBe(true);
    expect(isSecureCookie("production", "production")).toBe(true);
  });

  it("is Secure on a production build even if APP_ENV says development", () => {
    expect(isSecureCookie("development", "production")).toBe(true);
  });

  it("is not Secure only for local development, where there is no https", () => {
    expect(isSecureCookie("development", "development")).toBe(false);
    expect(isSecureCookie("development", "test")).toBe(false);
  });
});

describe("supabaseCookieOptions", () => {
  it("TASK-025 AC2: hides the session cookie from scripts, whatever the environment", () => {
    for (const [appEnv, nodeEnv] of [
      ["development", "development"],
      ["staging", "production"],
      ["production", "production"],
    ] as const) {
      expect(supabaseCookieOptions(appEnv, nodeEnv).httpOnly).toBe(true);
    }
  });

  it("TASK-025 AC2: is Secure on a non-development APP_ENV", () => {
    expect(supabaseCookieOptions("staging", "production").secure).toBe(true);
    expect(supabaseCookieOptions("production", "production").secure).toBe(true);
  });

  it("keeps the cookie same-site (lax) and site-wide", () => {
    const opts = supabaseCookieOptions("staging", "production");
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
  });

  it("leaves the lifetime to the library", () => {
    expect(supabaseCookieOptions("staging", "production")).not.toHaveProperty("maxAge");
  });
});
