"use client";

import Image from "next/image";
import type { KeyboardEvent } from "react";
import { Input } from "@/components/ui/field";
import { POLICY_RATE_MAX } from "@/lib/leave/policies-schema";

/** What one rate cell shows: the saved value, what is typed, and how the last save went. */
export type CellState = {
  saved: string | null;
  draft: string;
  status: "idle" | "busy" | "done" | "error";
  message: string;
};

/**
 * One employee's rate for one leave type, edited in place (EPIC-13). Enter or leaving the field saves a
 * changed value, Esc puts the saved value back. The state lives in the table (`PolicyTable`), because the
 * wide table and the phone cards show the same cells; this part is only the input and its messages. The
 * saving, saved and error states are announced (`role="status"`, `role="alert"`) and are never colour
 * alone.
 */
export function PolicyRateCell({
  id,
  label,
  cell,
  onDraft,
  onSave,
  onRevert,
}: {
  id: string;
  /** For a screen reader: "Vacation days a month for Elena Cruz". */
  label: string;
  cell: CellState;
  onDraft: (value: string) => void;
  onSave: () => void;
  onRevert: () => void;
}) {
  const messageId = `${id}-message`;

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onSave();
    } else if (event.key === "Escape") {
      onRevert();
    }
  }

  return (
    <div className="min-w-0">
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          max={POLICY_RATE_MAX}
          step="0.01"
          value={cell.draft}
          placeholder="Set rate"
          aria-label={label}
          aria-invalid={cell.status === "error" ? true : undefined}
          aria-describedby={messageId}
          onChange={(e) => onDraft(e.target.value)}
          onBlur={onSave}
          onKeyDown={onKeyDown}
          className="pr-9"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        >
          {cell.status === "busy" ? (
            <Image
              src="/icons/loader-circle.svg"
              alt=""
              width={16}
              height={16}
              unoptimized
              className="motion-safe:animate-spin"
            />
          ) : cell.status === "done" ? (
            <Image src="/icons/check-success.svg" alt="" width={16} height={16} unoptimized />
          ) : null}
        </span>
      </div>
      <div id={messageId} className="mt-1 min-h-4 text-xs">
        {cell.status === "error" ? (
          <p role="alert" className="font-medium text-rejected-fg">
            {cell.message}
          </p>
        ) : cell.status === "done" ? (
          <p role="status" className="font-medium text-approved-fg">
            {cell.message}
          </p>
        ) : cell.status === "busy" ? (
          <p role="status" className="text-ink-muted">
            Saving…
          </p>
        ) : null}
      </div>
    </div>
  );
}
