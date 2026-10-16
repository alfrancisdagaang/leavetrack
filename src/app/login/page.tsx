import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
  if (await getSession()) redirect(safeNextPath(nextPath));

  return <LoginView next={nextPath} allowMock={getEnv().ALLOW_MOCK_LOGIN} />;
}
