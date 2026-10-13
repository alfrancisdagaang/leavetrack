import { timingSafeEqual } from "node:crypto";

/**
 * Verifies `Authorization: Bearer <CRON_SECRET>` (the header Vercel Cron sends).
 * Fails closed: no configured secret → every request is rejected.
 */
export function verifyCronSecret(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const given = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
