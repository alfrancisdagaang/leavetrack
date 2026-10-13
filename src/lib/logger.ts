import pino from "pino";
import { getEnv } from "@/lib/env";

const env = getEnv();

/**
 * Structured application logger. Use this — never `console.*` (enforced by ESLint).
 * JSON everywhere except `next dev`. Pretty-printing keys off NODE_ENV (not APP_ENV) so a
 * production build never loads pino-pretty (a devDependency), even if APP_ENV is left unset.
 */
export const logger = pino({
  level: env.LOG_LEVEL ?? (env.APP_ENV === "development" ? "debug" : "info"),
  base: { app: "leavetrack", env: env.APP_ENV },
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "headers.cookie",
      "headers.authorization",
      "*.password",
      "*.token",
    ],
    censor: "[REDACTED]",
  },
  ...(process.env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});
