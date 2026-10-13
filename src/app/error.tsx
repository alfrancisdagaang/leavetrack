"use client";

/** Route-level error boundary. Never renders error details (digest only, for log correlation). */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main>
      <h1>Something went wrong</h1>
      <p role="alert">An unexpected error occurred. Please try again.</p>
      {error.digest ? <p>Reference: {error.digest}</p> : null}
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
