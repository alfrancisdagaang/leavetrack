import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { decideLeaveRequest } from "@/lib/leave/decide";

const MANAGER = "00000000-0000-4000-8000-000000000002";
const ELENA = "00000000-0000-4000-8000-000000000003";
const REQ = "30000000-0000-4000-8000-000000000001";
const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const UNPAID = "10000000-0000-4000-8000-000000000003";

type Call = { text: string; values: unknown[] };
type Script = {
  /** The decider's role; defaults to a manager. */
  role?: "employee" | "manager" | "hr_admin" | null;
  /** Rows the scoped, locking lookup returns; [] = not a direct report / not found. */
  lookup: unknown[];
  /** Rows the balance UPDATE returns; [] = nothing updated. */
  balanceUpdate?: unknown[];
  /** Rows the follow-up balance SELECT returns. */
  balanceRow?: unknown[];
  /** Rows the request UPDATE returns. */
  requestUpdate?: unknown[];
};

const DECIDED = {
  id: REQ,
  leave_type_id: VAC,
  start_date: "2026-11-02",
  end_date: "2026-11-04",
  reason: "",
  status: "approved",
  decided_by: MANAGER,
  decided_at: new Date(),
  decision_note: null,
};

/** A fake postgres.js client: records every statement and answers from a script. */
function fakeSql(script: Script) {
  const calls: Call[] = [];
  const tx = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    calls.push({ text, values });
    let rows: unknown[] = [];
    if (/^select role from public\.users/.test(text)) {
      rows = script.role === null ? [] : [{ role: script.role ?? "manager" }];
    } else if (/from public\.leave_requests r join public\.users u/.test(text))
      rows = script.lookup;
    else if (/^update public\.leave_balances/.test(text)) rows = script.balanceUpdate ?? [];
    else if (/^select balance from public\.leave_balances/.test(text)) {
      rows = script.balanceRow ?? [];
    } else if (/^update public\.leave_requests/.test(text)) {
      rows = script.requestUpdate ?? [DECIDED];
    }
    return Promise.resolve(rows);
  };
  const sql = { begin: (cb: (t: typeof tx) => Promise<unknown>) => cb(tx) } as unknown as Sql;
  const touched = (re: RegExp) => calls.filter((c) => re.test(c.text));
  return { sql, calls, touched };
}

const pending = (over: Record<string, unknown> = {}) => ({
  id: REQ,
  user_id: ELENA,
  leave_type_id: VAC,
  status: "pending",
  start_date: "2026-11-02", // Mon
  end_date: "2026-11-04", // Wed: 3 working days
  tracks_balance: true,
  ...over,
});

const approve = { decision: "approve" } as const;

describe("decideLeaveRequest: only managers decide (EPIC-10 AC1)", () => {
  it.each(["hr_admin", "employee"] as const)(
    "refuses a %s with FORBIDDEN before anything is looked up or written",
    async (role) => {
      const { sql, calls, touched } = fakeSql({ role, lookup: [pending()] });
      await expect(decideLeaveRequest(sql, MANAGER, REQ, approve)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: expect.stringContaining("Only managers can approve or reject"),
      });
      expect(touched(/^update|^insert/)).toHaveLength(0);
      expect(touched(/leave_requests r join/)).toHaveLength(0);
      expect(calls).toHaveLength(1);
    },
  );

  it("refuses a decider with no users row", async () => {
    const { sql } = fakeSql({ role: null, lookup: [pending()] });
    await expect(decideLeaveRequest(sql, MANAGER, REQ, approve)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("decideLeaveRequest", () => {
  it("US-03 AC1: approve decrements only the owner's balance for the request's own type, then audits", async () => {
    const { sql, calls, touched } = fakeSql({
      lookup: [pending()],
      balanceUpdate: [{ balance: "7.00" }],
    });

    const result = await decideLeaveRequest(sql, MANAGER, REQ, approve);

    expect(result.balance).toEqual({ leaveTypeId: VAC, balance: 7 });
    const [dec] = touched(/^update public\.leave_balances/);
    expect(dec?.values).toEqual([3, ELENA, VAC, 3]); // days, owner, request's own type, guard
    const [upd] = touched(/^update public\.leave_requests/);
    expect(upd?.values).toEqual(["approved", MANAGER, null, REQ]);
    const [audit] = touched(/^insert into public\.audit_log/);
    expect(audit?.values).toEqual([REQ, MANAGER, "approved"]);
    // Order matters: decider role, lookup, balance, request, audit, notification, all inside the one
    // transaction.
    expect(calls.map((c) => c.text.split(" ").slice(0, 2).join(" "))).toEqual([
      "select role",
      "select r.id,",
      "update public.leave_balances",
      "update public.leave_requests",
      "insert into", // audit_log
      "insert into", // notifications
    ]);
  });

  it("the lookup is scoped in SQL to the caller's direct reports and locks the row", async () => {
    const { sql, calls } = fakeSql({ lookup: [pending()], balanceUpdate: [{ balance: "7" }] });
    await decideLeaveRequest(sql, MANAGER, REQ, approve);
    const lookup = calls.find((c) => /leave_requests r join/.test(c.text));
    expect(lookup?.text).toContain("u.manager_id = ?");
    expect(lookup?.text).toContain("for update of r");
    expect(lookup?.values).toEqual([REQ, MANAGER]);
  });

  it("US-03 AC2: reject stores the note, leaves every balance alone and audits", async () => {
    const { sql, touched } = fakeSql({
      lookup: [pending()],
      requestUpdate: [{ ...DECIDED, status: "rejected", decision_note: "Team is short" }],
    });

    const result = await decideLeaveRequest(sql, MANAGER, REQ, {
      decision: "reject",
      note: "Team is short",
    });

    expect(result.balance).toBeNull();
    expect(touched(/leave_balances/)).toHaveLength(0);
    expect(touched(/^update public\.leave_requests/)[0]?.values).toEqual([
      "rejected",
      MANAGER,
      "Team is short",
      REQ,
    ]);
    expect(touched(/^insert into public\.audit_log/)[0]?.values).toEqual([
      REQ,
      MANAGER,
      "rejected",
    ]);
  });

  it("US-03 AC3: a request outside the caller's team is a 403 and nothing is written", async () => {
    const { sql, calls } = fakeSql({ lookup: [] });
    await expect(decideLeaveRequest(sql, MANAGER, REQ, approve)).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    expect(calls).toHaveLength(2); // only the role check and the lookup ran
  });

  it("a manager cannot decide their own request (the owner's manager is someone else)", async () => {
    // Same path as AC3: the scoped lookup finds nothing because users.manager_id is not the caller.
    const { sql } = fakeSql({ lookup: [] });
    await expect(decideLeaveRequest(sql, MANAGER, REQ, approve)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("Unpaid: approving never reads or writes leave_balances (PRD US-08)", async () => {
    const { sql, touched } = fakeSql({
      lookup: [pending({ leave_type_id: UNPAID, tracks_balance: false })],
    });
    const result = await decideLeaveRequest(sql, MANAGER, REQ, approve);
    expect(result.balance).toBeNull();
    expect(touched(/leave_balances/)).toHaveLength(0);
    expect(touched(/^insert into public\.audit_log/)).toHaveLength(1);
  });

  it("only ever references the request's own leave type, never a sibling", async () => {
    const { sql, touched } = fakeSql({
      lookup: [pending({ leave_type_id: SICK })],
      balanceUpdate: [{ balance: "2" }],
    });
    await decideLeaveRequest(sql, MANAGER, REQ, approve);
    const [dec] = touched(/^update public\.leave_balances/);
    expect(dec?.values).toContain(SICK);
    expect(dec?.values).not.toContain(VAC);
    expect(dec?.text).toContain("leave_type_id = ?");
  });

  it("US-08 AC1: approving a Sick request writes one balance update, for Sick only", async () => {
    const { sql, touched } = fakeSql({
      lookup: [pending({ leave_type_id: SICK })],
      balanceUpdate: [{ balance: "2.00" }],
    });
    const result = await decideLeaveRequest(sql, MANAGER, REQ, approve);

    expect(result.balance).toEqual({ leaveTypeId: SICK, balance: 2 });
    const writes = touched(/leave_balances/).filter((c) => /^update/.test(c.text));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.values).toEqual([3, ELENA, SICK, 3]);
    for (const c of touched(/leave_balances/)) {
      expect(c.values).not.toContain(VAC);
      expect(c.values).not.toContain(UNPAID);
    }
  });

  it("option A: insufficient balance is a 409 and no request update or audit row happens", async () => {
    const { sql, touched } = fakeSql({
      lookup: [pending()],
      balanceUpdate: [],
      balanceRow: [{ balance: "2.00" }],
    });
    const err = await decideLeaveRequest(sql, MANAGER, REQ, approve).catch((e) => e);
    expect(err).toMatchObject({ code: "CONFLICT", status: 409 });
    expect(err.message).toContain("only 2 are available");
    // TASK-040: it names the override and where HR does it, and no longer says "not available yet".
    expect(err.message).toContain("needs an HR override");
    expect(err.message).toContain("Balance Overrides");
    expect(err.message).not.toContain("not available yet");
    expect(touched(/^update public\.leave_requests/)).toHaveLength(0);
    expect(touched(/^insert into public\.audit_log/)).toHaveLength(0);
  });

  it("a negative balance is a 409 that does not promise an override (HR cannot override it)", async () => {
    const { sql, touched } = fakeSql({
      lookup: [pending()],
      balanceUpdate: [],
      balanceRow: [{ balance: "-2.00" }],
    });
    const err = await decideLeaveRequest(sql, MANAGER, REQ, approve).catch((e) => e);
    expect(err).toMatchObject({ code: "CONFLICT", status: 409 });
    expect(err.message).toContain("negative");
    expect(err.message).not.toContain("needs an HR override");
    expect(touched(/^update public\.leave_requests/)).toHaveLength(0);
    expect(touched(/^insert into public\.audit_log/)).toHaveLength(0);
  });

  it("a missing balance row on a tracked type is a 409 and nothing is created", async () => {
    const { sql, touched } = fakeSql({ lookup: [pending()], balanceUpdate: [], balanceRow: [] });
    const err = await decideLeaveRequest(sql, MANAGER, REQ, approve).catch((e) => e);
    expect(err).toMatchObject({ code: "CONFLICT" });
    expect(err.message).toContain("no balance record");
    expect(touched(/^insert into public\.leave_balances/)).toHaveLength(0);
    expect(touched(/^update public\.leave_requests/)).toHaveLength(0);
  });

  it("rejecting needs no balance at all, so an over-balance request can still be rejected", async () => {
    const { sql, touched } = fakeSql({
      lookup: [pending()],
      requestUpdate: [{ ...DECIDED, status: "rejected", decision_note: "x" }],
    });
    await expect(
      decideLeaveRequest(sql, MANAGER, REQ, { decision: "reject", note: "x" }),
    ).resolves.toBeDefined();
    expect(touched(/leave_balances/)).toHaveLength(0);
  });

  it("an already-decided request is a 409 and nothing is written", async () => {
    const { sql, calls } = fakeSql({ lookup: [pending({ status: "approved" })] });
    await expect(decideLeaveRequest(sql, MANAGER, REQ, approve)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(calls).toHaveLength(2); // the role check and the lookup; nothing written
  });

  // TASK-053 (US-03): the employee hears about the decision, in the same transaction.
  // Values of the one notifications statement: kind, request, employee, toEmployee, employee,
  // toManager, actor.
  describe("notifications (TASK-053)", () => {
    const notified = (t: ReturnType<typeof fakeSql>["touched"]) =>
      t(/^insert into public\.notifications/);

    it("AC2: approving notifies the employee only, with kind approved, written after the audit row", async () => {
      const { sql, calls, touched } = fakeSql({
        lookup: [pending()],
        balanceUpdate: [{ balance: "7.00" }],
      });
      await decideLeaveRequest(sql, MANAGER, REQ, approve);
      const found = notified(touched);
      expect(found).toHaveLength(1);
      expect(found[0]?.values).toEqual(["approved", REQ, ELENA, true, ELENA, false, MANAGER]);
      const at = (re: RegExp) => calls.findIndex((c) => re.test(c.text));
      expect(at(/^insert into public\.audit_log/)).toBeLessThan(
        at(/^insert into public\.notifications/),
      );
      expect(at(/^insert into public\.notifications/)).toBe(calls.length - 1);
    });

    it("AC2: rejecting notifies the employee only, with kind rejected", async () => {
      const { sql, touched } = fakeSql({
        lookup: [pending()],
        requestUpdate: [{ ...DECIDED, status: "rejected", decision_note: "No cover" }],
      });
      await decideLeaveRequest(sql, MANAGER, REQ, { decision: "reject", note: "No cover" });
      expect(notified(touched)[0]?.values).toEqual([
        "rejected",
        REQ,
        ELENA,
        true,
        ELENA,
        false,
        MANAGER,
      ]);
    });

    it("AC5: the statement never lets the actor be a recipient, and the recipients come from the database", async () => {
      const { sql, touched } = fakeSql({
        lookup: [pending()],
        balanceUpdate: [{ balance: "7.00" }],
      });
      await decideLeaveRequest(sql, MANAGER, REQ, approve);
      const text = notified(touched)[0]!.text;
      expect(text).toMatch(/where r\.id <> \?$/);
      expect(text).toMatch(/m\.role = 'manager'/);
    });

    it("a refused or lost decision writes no notification", async () => {
      for (const script of [
        { role: "hr_admin" as const, lookup: [pending()] },
        { lookup: [] },
        { lookup: [pending({ status: "approved" })] },
        { lookup: [pending()], balanceUpdate: [], balanceRow: [{ balance: "1.00" }] },
        { lookup: [pending()], balanceUpdate: [{ balance: "7" }], requestUpdate: [] },
      ]) {
        const { sql, touched } = fakeSql(script);
        await expect(decideLeaveRequest(sql, MANAGER, REQ, approve)).rejects.toBeDefined();
        expect(notified(touched)).toHaveLength(0);
      }
    });
  });
});
