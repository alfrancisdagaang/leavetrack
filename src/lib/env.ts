import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const EnvSchema = z
  .object({
    APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
    LOG_LEVEL: z.preprocess(
      emptyToUndefined,
      z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
    ),
    DATABASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    CRON_SECRET: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
    /** IANA time zone used to decide which day "today" is (default UTC when unset). */
    APP_TIMEZONE: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .refine((zone) => {
          try {
            new Intl.DateTimeFormat("en-US", { timeZone: zone });
            return true;
          } catch {
            return false;
          }
        }, "must be a valid IANA time zone, e.g. Asia/Manila")
        .optional(),
    ),
    /** Supabase project URL and anon key (both public by design; the service-role key is never an app variable). */
    NEXT_PUBLIC_SUPABASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
    /** Honour the labelled mock-role fallback. Unset: on in development, off everywhere else. */
    ALLOW_MOCK_LOGIN: z.preprocess(emptyToUndefined, z.enum(["true", "false"]).optional()),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== "production") return;
    for (const key of [
      "DATABASE_URL",
      "CRON_SECRET",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ] as const) {
      if (!env[key]) {
        ctx.addIssue({ code: "custom", path: [key], message: `${key} is required in production` });
      }
    }
  })
  .transform((env) => ({
    ...env,
    ALLOW_MOCK_LOGIN:
      env.ALLOW_MOCK_LOGIN === undefined
        ? env.APP_ENV === "development"
        : env.ALLOW_MOCK_LOGIN === "true",
  }));

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated server environment. Parsed lazily so `next build` never needs credentials. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
