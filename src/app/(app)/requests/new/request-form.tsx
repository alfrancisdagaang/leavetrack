"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BeforeYouSubmitCard } from "@/components/ui/before-you-submit";
import { DateField } from "@/components/ui/date-field";
import { LeaveTypeCards } from "@/components/ui/leave-type-cards";
import { RequestSuccess } from "@/components/ui/request-success";
import { RequestSummaryCard } from "@/components/ui/request-summary";
import { SubmitBar } from "@/components/ui/submit-bar";
import type { BalanceSummaryItem, LeaveWarning } from "@/lib/leave/balance";
import { buildPreview } from "@/lib/leave/request-preview";

type Submitted = {
  leaveTypeName: string;
  rangeText: string;
  daysText: string;
};

type SubmitState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "error"; message: string }
  | { status: "done"; warnings: LeaveWarning[]; submitted: Submitted };

const RANGE_ERROR = "End date must not be before the start date.";

/**
 * The Request leave workspace: the leave type cards and the details form on the left, the live
 * summary and the guidance on the right (one column on small screens, in that order). One shared
 * state feeds all of it. The server is the source of truth (validation, the over-balance warning in
 * the response); what is shown here before submitting is an early, advisory preview.
 */
export function RequestForm({
  balances,
  reviewerName,
}: {
  balances: BalanceSummaryItem[];
  /** Who reviews this person's leave; null when it could not be read (the row is then hidden). */
  reviewerName: string | null;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState(balances[0]?.leaveTypeId ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  // US-01 AC2, shown as soon as both dates are set. The server rejects it too; this makes it
  // visible and stops the submit even where the browser does not enforce `min` on date inputs.
  const preview = buildPreview({ balances, leaveTypeId, startDate, endDate });
  const rangeError = preview.kind === "invalid" ? RANGE_ERROR : undefined;
  const overBalance = preview.kind === "ready" && preview.days > 0 && preview.over;
  const done = state.status === "done";

  // After submitting, the form is replaced: move focus to the confirmation so keyboard and screen
  // reader users land on it instead of on a control that no longer exists.
  useEffect(() => {
    if (state.status === "done") document.getElementById("request-submitted-heading")?.focus();
  }, [state.status]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rangeError || preview.kind !== "ready") return;
    const submitted: Submitted = {
      leaveTypeName: preview.leaveTypeName,
      rangeText: preview.shortRangeText,
      daysText: `${preview.days} working day${preview.days === 1 ? "" : "s"}`,
    };
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
      setState({ status: "done", warnings: json.data.warnings ?? [], submitted });
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

  const error = state.status === "error" ? state.message : null;

  return (
    <div className="grid gap-6 pb-44 sm:pb-0 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0 space-y-6">
        <LeaveTypeCards
          balances={balances}
          value={leaveTypeId}
          onChange={setLeaveTypeId}
          disabled={done || state.status === "pending"}
        />
        {state.status === "done" ? (
          <RequestSuccess
            leaveTypeName={state.submitted.leaveTypeName}
            rangeText={state.submitted.rangeText}
            daysText={state.submitted.daysText}
            warnings={state.warnings}
            onAnother={reset}
          />
        ) : (
          <form
            onSubmit={onSubmit}
            aria-describedby={error ? "request-error" : undefined}
            className="flex flex-col gap-6 rounded-tile border border-line bg-white p-5 shadow-tile sm:p-6"
          >
            <h2 className="text-lg font-bold text-ink">Request details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <DateField
                id="start_date"
                label="Start date"
                value={startDate}
                onChange={setStartDate}
              />
              <DateField
                id="end_date"
                label="End date"
                value={endDate}
                onChange={setEndDate}
                min={startDate}
                hint="Must not be before the start date."
                error={rangeError}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="reason" className="block text-[13px] font-semibold text-ink">
                Reason <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <div className="relative">
                <textarea
                  id="reason"
                  name="reason"
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Add a reason for your request"
                  aria-describedby="reason-count"
                  className="block h-[104px] w-full resize-none rounded-lg border border-ink-muted bg-white px-3 pb-7 pt-3 text-sm leading-normal text-ink placeholder:text-ink-muted"
                />
                <span
                  id="reason-count"
                  className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-ink-muted"
                >
                  {reason.length} / 500
                </span>
              </div>
            </div>
            <SubmitBar
              pending={state.status === "pending"}
              blocked={Boolean(rangeError)}
              overBalance={overBalance}
              error={error}
            />
          </form>
        )}
      </div>
      <div className="min-w-0 space-y-6">
        <RequestSummaryCard preview={preview} reviewerName={reviewerName} />
        {done ? null : <BeforeYouSubmitCard overBalance={overBalance} />}
      </div>
    </div>
  );
}
