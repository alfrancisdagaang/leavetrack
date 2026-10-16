import { verifyCronSecret } from "@/lib/auth/cron";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { ok, withErrorHandling } from "@/lib/errors/respond";
import { runAccrual } from "@/lib/leave/accrual";
import { requireDb } from "@/lib/leave/service";

export const dynamic = "force-dynamic";
/** No request may run for the platform default of 300 s: a hang fails fast and is logged. */
export const maxDuration = 60;

/**
 * US-07 — monthly accrual. Vercel Cron calls this with an HTTP GET and
 * `Authorization: Bearer $CRON_SECRET`; POST is kept for manual runs and the original spec.
 * Both do the same thing and are safe to repeat: the job is idempotent (ADR-LeaveTrack-E002).
 *
 * src/proxy.ts already rejects /api/jobs/* without the bearer secret. The check is repeated here
 * so the job stays closed even if the proxy matcher changes.
 */
const handler = withErrorHandling(async (request) => {
  if (!verifyCronSecret(request.headers.get("authorization"), getEnv().CRON_SECRET)) {
    throw new AppError("UNAUTHORIZED", "Invalid cron credentials.");
  }
  return ok(await runAccrual(requireDb(), new Date()));
});

export const GET = handler;
export const POST = handler;
