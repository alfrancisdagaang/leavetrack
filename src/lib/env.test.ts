import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("runs with no variables at all (Day 0)", () => {
    expect(parseEnv({})).toEqual({ APP_ENV: "development", ALLOW_MOCK_LOGIN: true });
  });

  it("treats empty strings as unset", () => {
    const env = parseEnv({ DATABASE_URL: "", CRON_SECRET: "", LOG_LEVEL: "" });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.CRON_SECRET).toBeUndefined();
  });

  it("requires DATABASE_URL and CRON_SECRET in production", () => {
    expect(() => parseEnv({ APP_ENV: "production" })).toThrow(
      /DATABASE_URL.*CRON_SECRET.*NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("accepts a complete production config", () => {
    const env = parseEnv({
      APP_ENV: "production",
      DATABASE_URL: "postgresql://u:p@pooler.example.com:6543/postgres",
      CRON_SECRET: "x".repeat(32),
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });
    expect(env.APP_ENV).toBe("production");
  });

  it("defaults ALLOW_MOCK_LOGIN on in development and off elsewhere", () => {
    expect(parseEnv({}).ALLOW_MOCK_LOGIN).toBe(true);
    expect(parseEnv({ APP_ENV: "staging" }).ALLOW_MOCK_LOGIN).toBe(false);
  });

  it("lets ALLOW_MOCK_LOGIN be set explicitly and rejects other values", () => {
    expect(parseEnv({ APP_ENV: "staging", ALLOW_MOCK_LOGIN: "true" }).ALLOW_MOCK_LOGIN).toBe(true);
    expect(parseEnv({ ALLOW_MOCK_LOGIN: "false" }).ALLOW_MOCK_LOGIN).toBe(false);
    expect(() => parseEnv({ ALLOW_MOCK_LOGIN: "yes" })).toThrow(/ALLOW_MOCK_LOGIN/);
  });

  it("rejects a short CRON_SECRET", () => {
    expect(() => parseEnv({ CRON_SECRET: "short" })).toThrow(/CRON_SECRET/);
  });

  it("accepts a real IANA time zone and rejects a made-up one", () => {
    expect(parseEnv({ APP_TIMEZONE: "Asia/Manila" }).APP_TIMEZONE).toBe("Asia/Manila");
    expect(parseEnv({ APP_TIMEZONE: "" }).APP_TIMEZONE).toBeUndefined();
    expect(() => parseEnv({ APP_TIMEZONE: "Mars/Olympus" })).toThrow(/APP_TIMEZONE/);
  });
});
