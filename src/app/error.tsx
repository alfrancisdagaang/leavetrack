"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Route-level error boundary. Never renders error details (digest only, for log correlation). */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-8">
      <Card>
        <h1 className="mb-4 text-xl font-semibold text-ink">Something went wrong</h1>
        <div className="mb-4">
          <Alert variant="error">An unexpected error occurred. Please try again.</Alert>
        </div>
        {error.digest ? (
          <p className="mb-4 text-sm text-ink-muted">Reference: {error.digest}</p>
        ) : null}
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </Card>
    </main>
  );
}
