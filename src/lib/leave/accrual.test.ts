import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";
import { getLastAccrualPeriod, monthStart, runAccrual } from "@/lib/leave/accrual";

vi.mock("@/lib/logger", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { logger: { ...log, child: () => log } };
});

function fakeSql(rows: unknown[]) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
    return Promise.resolve(rows);
  }) as unknown as Sql;
  return { sql, calls };
}

describe("monthStart (UTC)", () => {
  it("returns the first day of the month", () => {
    expect(monthStart(new Date("2026-10-14T08:30:00Z"))).toBe("2026-10-01");
    expect(monthStart(new Date("2026-02-28T00:00:00Z"))).toBe("2026-02-01");
  });

  it("cuts months at UTC, not at the server's local time", () => {
    expect(monthStart(new Date("2026-10-31T23:59:59Z"))).toBe("2026-10-01");
    expect(monthStart(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11-01");
    expect(monthStart(new Date("2026-12-31T23:00:00Z"))).toBe("2026-12-01");
    expect(monthStart(new Date("2027-01-01T00:00:00Z"))).toBe("2027-01-01");
  });
});

describe("runAccrual", () => {
  it("is a single statement, parameterised with the UTC month (never string-built)", async () => {
    const { sql, calls } = fakeSql([{ ledger_rows: 4, credited: 4, periods: ["2026-10"] }]);
    await runAccrual(sql, new Date("2026-10-14T08:30:00Z"));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.values).toEqual(["2026-10-01"]);
  });

  it("US-07 AC2: idempotency lives in the ledger's unique key (ON CONFLICT DO NOTHING)", async () => {
    const { sql, calls } = fakeSql([{ ledger_rows: 0, credited: 0, periods: [] }]);
    await runAccrual(sql, new Date("2026-10-14T00:00:00Z"));
    const text = calls[0]?.text ?? "";
    expect(text).toContain("on conflict (user_id, leave_type_id, period) do nothing");
    // The balance is only credited from rows the ledger actually accepted.
    expect(text).toContain("from ledgered");
    expect(text).toContain("leave_balances.balance + excluded.balance");
  });

  it("only balance-tracked types accrue, so Unpaid never does", async () => {
    const { sql, calls } = fakeSql([{ ledger_rows: 0, credited: 0, periods: [] }]);
    await runAccrual(sql, new Date("2026-10-14T00:00:00Z"));
    expect(calls[0]?.text).toContain("where lt.tracks_balance");
  });

  it("builds months from timestamps so the session time zone cannot shift them", async () => {
    const { sql, calls } = fakeSql([{ ledger_rows: 0, credited: 0, periods: [] }]);
    await runAccrual(sql, new Date("2026-10-14T00:00:00Z"));
    expect(calls[0]?.text).toContain("generate_series(s.period::timestamp");
  });

  it("reports what happened", async () => {
    const { sql } = fakeSql([{ ledger_rows: 14, credited: 14, periods: ["2026-10", "2026-11"] }]);
    await expect(runAccrual(sql, new Date("2026-11-01T00:00:00Z"))).resolves.toEqual({
      period: "2026-11",
      periods_accrued: ["2026-10", "2026-11"],
      ledger_entries: 14,
      balances_updated: 14,
    });
  });

  it("a run that finds everything already accrued reports zero work", async () => {
    const { sql } = fakeSql([{ ledger_rows: 0, credited: 0, periods: [] }]);
    const result = await runAccrual(sql, new Date("2026-10-20T00:00:00Z"));
    expect(result).toMatchObject({ ledger_entries: 0, balances_updated: 0, periods_accrued: [] });
  });
});

describe("getLastAccrualPeriod", () => {
  it("returns the latest accrued month, or null if the job has never run", async () => {
    expect(await getLastAccrualPeriod(fakeSql([{ period: "2026-10" }]).sql)).toBe("2026-10");
    expect(await getLastAccrualPeriod(fakeSql([{ period: null }]).sql)).toBeNull();
  });
});
