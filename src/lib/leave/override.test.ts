import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { overrideLeaveRequest } from "@/lib/leave/override";

const HR = "00000000-0000-4000-8000-000000000001";
const ELENA = "00000000-0000-4000-8000-000000000003";
const REQ = "30000000-0000-4000-8000-000000000001";
const VAC = "10000000-0000-4000-8000-000000000001";

type Call = { text: string; values: unknown[] };
type Script = {
  /** Rows the locking lookup returns; [] = missing, deleted or the caller's own request. */
  lookup: unknown[];
  /** Rows the locked balance SELECT returns; [] = no balance record. */
  balanceRow?: unknown[];
  /** Rows the request UPDATE returns; [] = lost the race. */
  requestUpdate?: unknown[];
};

const DECIDED = {
  id: REQ,
  leave_type_id: VAC,
  start_date: "2026-11-02",
  end_date: "2026-11-04",
  reason: "",
  status: "approved",
  decided_by: HR,
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
    if (/from public\.leave_requests r join public\.leave_types lt/.test(text)) {
      rows = script.lookup;
    } else if (/^select balance::text as balance from public\.leave_balances/.test(text)) {
      rows = script.balanceRow ?? [];
    } else if (/^update public\.leave_requests/.test(text)) {
      rows = script.requestUpdate ?? [DECIDED];
    } else if (/^insert into public\.audit_log/.test(text) && /override_approved/.test(text)) {
      rows = [{ shortfall: "2.00" }];
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
const reject = { decision: "reject", note: "Not enough cover" } as const;
const run = (s: ReturnType<typeof fakeSql>, input: Parameters<typeof overrideLeaveRequest>[3]) =>
  overrideLeaveRequest(s.sql, HR, REQ, input);

describe("overrideLeaveRequest", () => {
  it("looks the request up by id, not deleted, not the caller's own, with no team filter", async () => {
    const s = fakeSql({ lookup: [pending()], balanceRow: [{ balance: "1.00" }] });
    await run(s, approve);
    const lookup = s.calls[0]!;
    expect(lookup.text).toContain("r.user_id <> ?");
    expect(lookup.text).toContain("r.is_deleted = false");
    expect(lookup.text).toContain("for update of r");
    expect(lookup.text).not.toContain("manager_id");
    expect(lookup.values).toEqual([REQ, HR]);
  });

  it("a missing, deleted or own request is FORBIDDEN and nothing else runs", async () => {
    const s = fakeSql({ lookup: [] });
    await expect(run(s, approve)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(s.calls).toHaveLength(1);
  });

  it("a request that is not pending is a CONFLICT and changes nothing", async () => {
    const s = fakeSql({ lookup: [pending({ status: "approved" })] });
    await expect(run(s, approve)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This request has already been approved.",
    });
    expect(s.calls).toHaveLength(1);
  });

  it("an untracked type (Unpaid) is a CONFLICT and never reads a balance", async () => {
    const s = fakeSql({ lookup: [pending({ tracks_balance: false })] });
    await expect(run(s, approve)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(s.touched(/leave_balances/)).toHaveLength(0);
  });

  it("no balance row is a CONFLICT", async () => {
    const s = fakeSql({ lookup: [pending()], balanceRow: [] });
    await expect(run(s, approve)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("no balance record"),
    });
    expect(s.touched(/^update/)).toHaveLength(0);
  });

  it("a request within balance is a CONFLICT for approve and reject alike", async () => {
    for (const balance of ["3.00", "10.00"]) {
      for (const input of [approve, reject]) {
        const s = fakeSql({ lookup: [pending()], balanceRow: [{ balance }] });
        await expect(run(s, input)).rejects.toMatchObject({
          code: "CONFLICT",
          message: expect.stringContaining("within balance"),
        });
        expect(s.touched(/^update|^insert/)).toHaveLength(0);
      }
    }
  });

  it("a weekend-only request is 0 days, so it is never over balance", async () => {
    const s = fakeSql({
      lookup: [pending({ start_date: "2026-11-07", end_date: "2026-11-08" })],
      balanceRow: [{ balance: "0.00" }],
    });
    await expect(run(s, approve)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("a negative balance is refused with its own message, nothing is written", async () => {
    const s = fakeSql({ lookup: [pending()], balanceRow: [{ balance: "-2.00" }] });
    await expect(run(s, approve)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("negative"),
    });
    expect(s.touched(/^update|^insert/)).toHaveLength(0);
  });

  it("AC1: approve sets that one balance to 0, decides as HR, and records the shortfall", async () => {
    const s = fakeSql({ lookup: [pending()], balanceRow: [{ balance: "1.00" }] });
    const result = await run(s, approve);

    const [balanceUpdate] = s.touched(/^update public\.leave_balances/);
    expect(balanceUpdate!.text).toContain("set balance = 0");
    expect(balanceUpdate!.values).toEqual([ELENA, VAC]);

    const [requestUpdate] = s.touched(/^update public\.leave_requests/);
    expect(requestUpdate!.text).toContain("status = 'pending'");
    expect(requestUpdate!.values).toContain(HR);

    const [audit] = s.touched(/^insert into public\.audit_log/);
    expect(audit!.text).toContain("'override_approved'");
    // request, actor, days requested (3), balance before as the exact text, then the two casts
    expect(audit!.values).toEqual([REQ, HR, 3, "1.00", 3, "1.00"]);

    expect(result.balance).toEqual({ leaveTypeId: VAC, balance: 0 });
    expect(result.shortfall).toBe("2.00");
  });

  it("AC1: the audit row is written last, after the balance and the request (one transaction)", async () => {
    const s = fakeSql({ lookup: [pending()], balanceRow: [{ balance: "0.00" }] });
    await run(s, approve);
    const at = (re: RegExp) => s.calls.findIndex((c) => re.test(c.text));
    const balanceAt = at(/^update public\.leave_balances/);
    const requestAt = at(/^update public\.leave_requests/);
    const auditAt = at(/^insert into public\.audit_log/);
    expect(balanceAt).toBeGreaterThan(-1);
    expect(balanceAt).toBeLessThan(requestAt);
    expect(requestAt).toBeLessThan(auditAt);
    expect(auditAt).toBe(s.calls.length - 1);
  });

  it("AC2: reject needs no balance change, records the note and a rejected audit row", async () => {
    const s = fakeSql({
      lookup: [pending()],
      balanceRow: [{ balance: "1.00" }],
      requestUpdate: [{ ...DECIDED, status: "rejected", decision_note: "Not enough cover" }],
    });
    const result = await run(s, reject);

    expect(s.touched(/^update public\.leave_balances/)).toHaveLength(0);
    const [requestUpdate] = s.touched(/^update public\.leave_requests/);
    expect(requestUpdate!.values).toEqual([HR, "Not enough cover", REQ]);
    const [audit] = s.touched(/^insert into public\.audit_log/);
    expect(audit!.text).toContain("'rejected'");
    expect(audit!.values).toEqual([REQ, HR]);
    expect(result.balance).toBeNull();
    expect(result.shortfall).toBeNull();
  });

  it("AC6: losing the race (the request is no longer pending) is a CONFLICT and writes no audit row", async () => {
    const s = fakeSql({
      lookup: [pending()],
      balanceRow: [{ balance: "1.00" }],
      requestUpdate: [],
    });
    await expect(run(s, approve)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(s.touched(/^insert into public\.audit_log/)).toHaveLength(0);
  });
});
