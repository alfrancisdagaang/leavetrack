"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/redirect";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { USER_ROLES } from "@/lib/db/types";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export type LoginState = { error: string | null };

const LoginSchema = z.object({
  // ⚠ MOCK AUTH: name/email are accepted as-is and never checked (ADR-LeaveTrack-E001).
  name: z.string().trim().max(200),
  email: z.string().trim().max(320),
  role: z.enum(USER_ROLES),
  next: z.string().optional(),
});

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose a valid role to continue." };

  (await cookies()).set(SESSION_COOKIE, parsed.data.role, sessionCookieOptions(getEnv().APP_ENV));
  logger.info({ role: parsed.data.role }, "Mock login");
  redirect(safeNextPath(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
