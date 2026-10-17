import pino from "pino";
import { getEnv } from "@/lib/env";

const env = getEnv();

/**
 * Fields whose value must never reach a log line. pino's `*` matches exactly one level, so each
 * secret is listed at the top level and one level down. The rule is still "do not log these":
 * redaction is the safety net for a mistake, not permission.
 */
const SECRET_KEYS = [
  "password",
  "token",
  "access_token",
  "refresh_token",
  "cookie",
  "authorization",
] as const;

export const REDACT_PATHS: string[] = [
  "req.headers.cookie",
  "req.headers.authorization",
  "headers.cookie",
  "headers.authorization",
  ...SECRET_KEYS,
  ...SECRET_KEYS.map((key) => `*.${key}`),
];

/**
 * Structured application logger. Use this — never `console.*` (enforced by ESLint).
 * JSON everywhere except `next dev`. Pretty-printing keys off NODE_ENV (not APP_ENV) so a
 * production build never loads pino-pretty (a devDependency), even if APP_ENV is left unset.
 */
export const logger = pino({
  level: env.LOG_LEVEL ?? (env.APP_ENV === "development" ? "debug" : "info"),
  base: { app: "leavetrack", env: env.APP_ENV },
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  ...(process.env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});
