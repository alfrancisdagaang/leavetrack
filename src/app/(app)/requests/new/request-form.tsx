"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  overBalanceWarning,
  type BalanceSummaryItem,
  type LeaveWarning,
} from "@/lib/leave/balance";
import { countWorkingDays } from "@/lib/leave/working-days";

type SubmitState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "error"; message: string }
  | { status: "done"; warnings: LeaveWarning[] };

/**
 * Interactive part of the submit page. The server is the source of truth (validation, the
 * over-balance warning in the response); the live warning here is an early, advisory preview.
 */
export function RequestForm({ balances }: { balances: BalanceSummaryItem[] }) {
  const [leaveTypeId, setLeaveTypeId] = useState(balances[0]?.leaveTypeId ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  // US-01 AC2, shown as soon as both dates are set. The server rejects it too; this makes it
  // visible and stops the submit even where the browser does not enforce `min` on date inputs.
  const rangeError =
    startDate && endDate && endDate < startDate
      ? "End date must not be before the start date."
      : undefined;
  const days = startDate && endDate && !rangeError ? countWorkingDays(startDate, endDate) : 0;
  const preview = days > 0 ? overBalanceWarning(balances, leaveTypeId, days) : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rangeError) return;
    setState({ status: "pending" });
    try {
      const res = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leave_type_id: leaveTypeId,
          start_date: startDate,
          end_date: endDate,
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setState({
          status: "error",
          message: json?.error?.message ?? "The request could not be submitted.",
        });
        return;
      }
      setState({ status: "done", warnings: json.data.warnings ?? [] });
    } catch {
      setState({ status: "error", message: "Could not reach the server. Please try again." });
    }
  }

  function reset() {
    setStartDate("");
    setEndDate("");
    setReason("");
    setState({ status: "idle" });
  }

  if (state.status === "done") {
    return (
      <div className="space-y-4">
        <Alert variant="info" title="Request submitted">
          Your manager can now review it. It shows as pending on your balance page.
        </Alert>
        {state.warnings.map((w) => (
          <Alert key={w.code} variant="warning" title="Over your available balance">
            {w.message}
          </Alert>
        ))}
        <div className="flex flex-wrap gap-3">
          <Link href="/balance" className={buttonClasses("primary")}>
            View my balance
          </Link>
          <Button variant="secondary" onClick={reset}>
            Submit another
          </Button>
        </div>
      </div>
    );
  }

  const error = state.status === "error" ? state.message : null;

  return (
    <form
      onSubmit={onSubmit}
      aria-describedby={error ? "request-error" : undefined}
      className="space-y-4"
    >
      <Field id="leave_type_id" label="Leave type">
        <Select
          id="leave_type_id"
          name="leave_type_id"
          required
          value={leaveTypeId}
          onChange={(e) => setLeaveTypeId(e.target.value)}
        >
          {balances.map((b) => (
            <option key={b.leaveTypeId} value={b.leaveTypeId}>
              {b.leaveTypeName}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="start_date" label="Start date">
          <Input
            id="start_date"
            name="start_date"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field
          id="end_date"
          label="End date"
          hint="Must not be before the start date."
          error={rangeError}
        >
          <Input
            id="end_date"
            name="end_date"
            type="date"
            required
            min={startDate || undefined}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby={rangeError ? "end_date-hint end_date-error" : "end_date-hint"}
          />
        </Field>
      </div>
      {days > 0 ? (
        <p className="text-sm text-grey-700">
          {days} working day{days === 1 ? "" : "s"} (Mon-Fri).
        </p>
      ) : null}
      <Field id="reason" label="Reason (optional)">
        <Textarea
          id="reason"
          name="reason"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      {preview ? (
        <Alert variant="warning" title="Over your available balance">
          {preview.message}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="error" id="request-error">
          {error}
        </Alert>
      ) : null}
      <Button
        type="submit"
        pending={state.status === "pending"}
        disabled={Boolean(rangeError)}
        className="w-full sm:w-auto"
      >
        {state.status === "pending" ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
