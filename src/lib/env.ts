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
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== "production") return;
    for (const key of ["DATABASE_URL", "CRON_SECRET"] as const) {
      if (!env[key]) {
        ctx.addIssue({ code: "custom", path: [key], message: `${key} is required in production` });
      }
    }
  });

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
