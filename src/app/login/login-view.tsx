import { LoginForm } from "@/app/login/login-form";
import { MockLoginForm } from "@/app/login/mock-login-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

/** The sign-in screen. The mock card is rendered only when `allowMock` (ALLOW_MOCK_LOGIN) is true. */
export function LoginView({ next, allowMock }: { next?: string; allowMock: boolean }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <p className="text-center text-3xl font-semibold tracking-tight text-ink">leavetrack</p>
        <Card>
          <h1 className="mb-1 text-xl font-semibold text-ink">Sign in</h1>
          <p className="mb-4 text-sm text-ink-muted">Use your LeaveTrack email and password.</p>
          <LoginForm next={next} />
        </Card>
        {allowMock ? (
          <Card>
            <h2 className="mb-3 text-base font-semibold text-ink">Demo only: mock sign-in</h2>
            <div className="mb-4">
              <Alert variant="warning" title="Not real authentication">
                Fake data only. Any name and email are accepted; the role you pick decides what you
                can see.
              </Alert>
            </div>
            <MockLoginForm next={next} />
          </Card>
        ) : null}
      </div>
    </main>
  );
}
