import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("runs with no variables at all (Day 0)", () => {
    expect(parseEnv({})).toEqual({ APP_ENV: "development" });
  });

  it("treats empty strings as unset", () => {
    const env = parseEnv({ DATABASE_URL: "", CRON_SECRET: "", LOG_LEVEL: "" });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.CRON_SECRET).toBeUndefined();
  });

  it("requires DATABASE_URL and CRON_SECRET in production", () => {
    expect(() => parseEnv({ APP_ENV: "production" })).toThrow(/DATABASE_URL.*CRON_SECRET/);
  });

  it("accepts a complete production config", () => {
    const env = parseEnv({
      APP_ENV: "production",
      DATABASE_URL: "postgresql://u:p@pooler.example.com:6543/postgres",
      CRON_SECRET: "x".repeat(32),
    });
    expect(env.APP_ENV).toBe("production");
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
