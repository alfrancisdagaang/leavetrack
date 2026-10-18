import Image from "next/image";
import { BrandPanel } from "@/app/login/brand-panel";
import { LoginForm } from "@/app/login/login-form";
import { MockLoginForm } from "@/app/login/mock-login-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

/**
 * The sign-in screen: from `lg` a navy brand panel beside the form, below it just the form on the
 * page background. The mock card is rendered only when `allowMock` (ALLOW_MOCK_LOGIN) is true.
 */
export function LoginView({ next, allowMock }: { next?: string; allowMock: boolean }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <BrandPanel />
      <div className="flex items-center justify-center px-4 py-8 sm:px-8 lg:bg-white">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center justify-center gap-3 lg:justify-start">
            <Image src="/icons/logo.svg" alt="" width={40} height={40} unoptimized />
            <p className="text-2xl font-bold text-ink">LeaveTrack</p>
          </div>
          <div className="rounded-tile border border-brand-50 bg-white p-5 shadow-tile sm:p-6 lg:border-0 lg:p-0 lg:shadow-none">
            <h1 className="mb-1 text-3xl font-semibold tracking-tight text-ink">Sign in</h1>
            <p className="mb-6 text-ink-muted">Welcome back. Please sign in to continue.</p>
            <LoginForm next={next} />
          </div>
          <p className="text-center text-sm text-ink-muted lg:text-left">
            Need access? Ask HR to add your email.
          </p>
          {allowMock ? (
            <Card>
              <h2 className="mb-3 text-base font-semibold text-ink">Demo only: mock sign-in</h2>
              <div className="mb-4">
                <Alert variant="warning" title="Not real authentication">
                  Fake data only. Any name and email are accepted; the role you pick decides what
                  you can see.
                </Alert>
              </div>
              <MockLoginForm next={next} />
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  );
}
