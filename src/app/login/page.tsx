import type { Metadata } from "next";
import { LoginForm } from "@/app/login/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;

  return (
    <main>
      <h1>Sign in to LeaveTrack</h1>
      <p role="note">
        <strong>Development mock sign-in.</strong> Any name and email are accepted; the role you
        pick decides what you can see. Real authentication replaces this before launch.
      </p>
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </main>
  );
}
