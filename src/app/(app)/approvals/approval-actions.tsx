"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";

type Mode = "idle" | "rejecting";

/**
 * Approve / reject controls for one pending request. The server decides everything that matters
 * (scope, balance, status); `canApprove` only avoids offering a button the server would refuse.
 */
export function ApprovalActions({
  requestId,
  canApprove,
}: {
  requestId: string;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: { decision: "approve" } | { decision: "reject"; note: string }) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/leave-requests/${requestId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? "The decision could not be saved.");
        setPending(false);
        return;
      }
      router.refresh(); // the decided request leaves the pending queue
    } catch {
      setError("Could not reach the server. Please try again.");
      setPending(false);
    }
  }

  function onReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send({ decision: "reject", note });
  }

  return (
    <div className="mt-4 space-y-3">
      {mode === "idle" ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => void send({ decision: "approve" })}
            pending={pending}
            disabled={!canApprove}
            className="w-full sm:w-auto"
          >
            Approve
          </Button>
          <Button
            variant="secondary"
            onClick={() => setMode("rejecting")}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            Reject
          </Button>
        </div>
      ) : (
        <form onSubmit={onReject} className="space-y-3">
          <Field
            id={`note-${requestId}`}
            label="Reason for rejection"
            hint="Shown to the employee."
          >
            <Textarea
              id={`note-${requestId}`}
              rows={3}
              maxLength={500}
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby={`note-${requestId}-hint`}
            />
          </Field>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              pending={pending}
              disabled={note.trim().length === 0}
              className="w-full sm:w-auto"
            >
              Confirm rejection
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setMode("idle");
                setError(null);
              }}
              disabled={pending}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}
