"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password-schema";

type Status =
  { kind: "idle" } | { kind: "busy" } | { kind: "done" } | { kind: "error"; message: string };

const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";

/** The message from the standard error envelope, or null when the answer is not one. */
function envelopeMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const error = (body as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : null;
}

/**
 * Change-password form (TASK-065). Checks length and match before posting so the common mistakes
 * answer at once; the route checks everything again and stays the authority. It posts JSON to
 * `/api/account/password`, keeps the passwords only in memory and clears them on success.
 */
export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === "busy") return;

    const problem =
      next.length < PASSWORD_MIN_LENGTH
        ? `New password must be at least ${PASSWORD_MIN_LENGTH} characters.`
        : next.length > PASSWORD_MAX_LENGTH
          ? `New password must be at most ${PASSWORD_MAX_LENGTH} characters.`
          : next !== confirm
            ? "The confirmation does not match the new password."
            : next === current
              ? "The new password must be different from the current one."
              : null;
    if (problem) {
      setStatus({ kind: "error", message: problem });
      return;
    }

    setStatus({ kind: "busy" });
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          current_password: current,
          new_password: next,
          confirm_password: confirm,
        }),
      });
      if (response.ok) {
        setCurrent("");
        setNext("");
        setConfirm("");
        setStatus({ kind: "done" });
        return;
      }
      const body: unknown = await response.json().catch(() => null);
      setStatus({
        kind: "error",
        message: envelopeMessage(body) ?? "Your password could not be changed. Try again.",
      });
    } catch {
      setStatus({ kind: "error", message: NETWORK_ERROR });
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-md grid-cols-1 gap-4" noValidate>
      <PasswordInput
        id="current-password"
        name="current_password"
        label="Current password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <PasswordInput
        id="new-password"
        name="new_password"
        label="New password"
        autoComplete="new-password"
        hint={`${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters.`}
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <PasswordInput
        id="confirm-password"
        name="confirm_password"
        label="Confirm new password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {status.kind === "error" ? (
        <Alert variant="error" id="password-error">
          {status.message}
        </Alert>
      ) : null}
      {status.kind === "done" ? (
        <p
          role="status"
          className="rounded-lg border border-approved-fg/30 bg-approved-bg px-4 py-3 text-sm text-approved-fg"
        >
          Your password was changed. Your other devices were signed out.
        </p>
      ) : null}
      <div>
        <Button type="submit" pending={status.kind === "busy"}>
          {status.kind === "busy" ? "Changing password…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}
