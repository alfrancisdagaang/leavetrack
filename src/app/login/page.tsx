import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { LoginView } from "@/app/login/login-view";
import { safeNextPath } from "@/lib/auth/redirect";
import { getSession } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  // The proxy lets everyone reach /login; people who are already signed in move on from here.
  // If the session cannot be checked right now, still show the form rather than an error page.
  const session = await getSession().catch((err: unknown) => {
    unstable_rethrow(err);
    return null;
  });
  if (session) redirect(safeNextPath(nextPath));

  return <LoginView next={nextPath} allowMock={getEnv().ALLOW_MOCK_LOGIN} />;
}
