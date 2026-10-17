import pino from "pino";
import { describe, expect, it } from "vitest";
import { REDACT_PATHS } from "@/lib/logger";

/** A pino instance with the app's real redact list, writing to memory. */
function capture(): { log: pino.Logger; lines: string[] } {
  const lines: string[] = [];
  const log = pino(
    { redact: { paths: REDACT_PATHS, censor: "[REDACTED]" } },
    { write: (chunk: string) => void lines.push(chunk) },
  );
  return { log, lines };
}

const SECRET = "s3cr3t-value";

describe("logger redaction", () => {
  it("TASK-025 AC3: censors a secret at the top level of the log object", () => {
    for (const key of [
      "password",
      "token",
      "access_token",
      "refresh_token",
      "cookie",
      "authorization",
    ]) {
      const { log, lines } = capture();
      log.warn({ [key]: SECRET }, "x");
      expect(lines.join("")).not.toContain(SECRET);
      expect(lines.join("")).toContain("[REDACTED]");
    }
  });

  it("TASK-025 AC3: censors a secret one level down, such as inside an error context", () => {
    for (const key of [
      "password",
      "token",
      "access_token",
      "refresh_token",
      "cookie",
      "authorization",
    ]) {
      const { log, lines } = capture();
      log.error({ session: { [key]: SECRET } }, "x");
      expect(lines.join("")).not.toContain(SECRET);
    }
  });

  it("TASK-025 AC3: censors request headers", () => {
    const { log, lines } = capture();
    log.info({ req: { headers: { cookie: SECRET, authorization: `Bearer ${SECRET}` } } }, "x");
    log.info({ headers: { cookie: SECRET, authorization: `Bearer ${SECRET}` } }, "x");
    expect(lines.join("")).not.toContain(SECRET);
  });

  it("still logs ordinary fields", () => {
    const { log, lines } = capture();
    log.info({ userId: "u1", role: "manager" }, "Signed in");
    expect(lines.join("")).toContain('"userId":"u1"');
  });
});
