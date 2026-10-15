import type { Metadata } from "next";
import { LoginForm } from "@/app/login/login-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <p className="text-center text-3xl font-semibold tracking-tight text-ink">leavetrack</p>
        <Card>
          <h1 className="mb-4 text-xl font-semibold text-ink">Sign in</h1>
          <div className="mb-5">
            <Alert variant="warning" title="Demo sign-in">
              Fake data only. Any name and email are accepted; the role you pick decides what you
              can see. Real authentication replaces this before launch.
            </Alert>
          </div>
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </Card>
      </div>
    </main>
  );
}
