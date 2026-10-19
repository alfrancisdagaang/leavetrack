import { describe, expect, it } from "vitest";
import { checkOverBalance } from "@/lib/leave/over-balance";

const check = (balance: number | null, days: number, tracksBalance = true) =>
  checkOverBalance({ tracksBalance, balance, days });

describe("checkOverBalance", () => {
  it("an untracked type (Unpaid) is never over balance, whatever the balance", () => {
    expect(check(null, 9, false)).toEqual({ kind: "ok" });
    expect(check(0, 9, false)).toEqual({ kind: "ok" });
    expect(check(-3, 9, false)).toEqual({ kind: "ok" });
  });

  it("a tracked type with no balance row is its own state, not 'over'", () => {
    expect(check(null, 3)).toEqual({ kind: "no_balance_record" });
  });

  it("a negative balance is its own state, not 'over' (HR cannot override it)", () => {
    expect(check(-2, 3)).toEqual({ kind: "negative", balance: -2 });
  });

  it("enough balance is ok, including exactly equal", () => {
    expect(check(5, 3)).toEqual({ kind: "ok" });
    expect(check(3, 3)).toEqual({ kind: "ok" });
  });

  it("AC1: 2 available and 5 requested is over by exactly 3", () => {
    expect(check(2, 5)).toEqual({ kind: "over", balance: 2, shortfall: 3 });
  });

  it("a balance of 0 is over for any request of at least one day", () => {
    expect(check(0, 1)).toEqual({ kind: "over", balance: 0, shortfall: 1 });
  });

  it("fractions are exact to the hundredth (no floating point drift)", () => {
    expect(check(4.5, 5)).toEqual({ kind: "over", balance: 4.5, shortfall: 0.5 });
    expect(check(0.1, 0.3)).toEqual({ kind: "over", balance: 0.1, shortfall: 0.2 });
    expect(check(11.25, 11.25)).toEqual({ kind: "ok" });
    expect(check(11.2, 11.25)).toEqual({ kind: "over", balance: 11.2, shortfall: 0.05 });
  });

  it("a weekend-only request (0 days) is never over balance", () => {
    expect(check(0, 0)).toEqual({ kind: "ok" });
    expect(check(2, 0)).toEqual({ kind: "ok" });
  });
});
