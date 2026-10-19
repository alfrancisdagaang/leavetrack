import type { TransactionSql } from "postgres";
import { describe, expect, it } from "vitest";
import { notifyLeaveEvent } from "@/lib/leave/notify";

const EMP = "00000000-0000-4000-8000-000000000003";
const ACTOR = "00000000-0000-4000-8000-000000000002";
const REQ = "30000000-0000-4000-8000-000000000001";

function capture() {
  const calls: { text: string; values: unknown[] }[] = [];
  const tx = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
    return Promise.resolve([]);
  }) as unknown as TransactionSql;
  return { tx, calls };
}

describe("notifyLeaveEvent (TASK-053)", () => {
  it("is one statement, with every value passed as a parameter (AGENTS.md rule 6)", async () => {
    const { tx, calls } = capture();
    await notifyLeaveEvent(tx, {
      kind: "overridden",
      requestId: REQ,
      employeeId: EMP,
      actorId: ACTOR,
      toEmployee: true,
      toManager: true,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values).toEqual(["overridden", REQ, EMP, true, EMP, true, ACTOR]);
    expect(calls[0]!.text).not.toContain("overridden");
    expect(calls[0]!.text).not.toContain(EMP);
  });

  it("finds the manager from the employee's own manager_id, only when that person is a manager, and never the actor", async () => {
    const { tx, calls } = capture();
    await notifyLeaveEvent(tx, {
      kind: "submitted",
      requestId: REQ,
      employeeId: EMP,
      actorId: EMP,
      toEmployee: false,
      toManager: true,
    });
    const text = calls[0]!.text;
    expect(text).toMatch(
      /^insert into public\.notifications \(recipient_id, kind, leave_request_id\)/,
    );
    expect(text).toMatch(/join public\.users m on m\.id = e\.manager_id/);
    expect(text).toMatch(/m\.role = 'manager'/);
    expect(text).toMatch(/where r\.id <> \?$/);
  });

  it("stores no personal text: the statement names no reason, note or name column", async () => {
    const { tx, calls } = capture();
    await notifyLeaveEvent(tx, {
      kind: "approved",
      requestId: REQ,
      employeeId: EMP,
      actorId: ACTOR,
      toEmployee: true,
      toManager: false,
    });
    expect(calls[0]!.text).not.toMatch(/reason|decision_note|\bname\b|email/);
  });
});
