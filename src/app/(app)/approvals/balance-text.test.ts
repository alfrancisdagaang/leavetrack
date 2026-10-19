import { describe, expect, it } from "vitest";
import { balanceText } from "./balance-text";

describe("balanceText (TASK-040)", () => {
  it("says nothing for a request the manager can approve", () => {
    expect(balanceText({ kind: "ok" }, 3, "Vacation")).toBeNull();
  });

  it("over balance: how far over and that it waits for HR, in words", () => {
    const text = balanceText({ kind: "over", balance: 2, shortfall: 3 }, 5, "Vacation")!;
    expect(text.headline).toBe("Over balance by 3 days");
    expect(text.detail).toContain("Waiting for HR override");
    expect(text.detail).toContain("5 working days");
    expect(text.detail).toContain("Vacation balance is 2 days");
    expect(text.detail).toContain("you can reject it");
  });

  it("writes one day and fractions as people say them", () => {
    expect(balanceText({ kind: "over", balance: 0, shortfall: 1 }, 1, "Sick")!.headline).toBe(
      "Over balance by 1 day",
    );
    expect(balanceText({ kind: "over", balance: 4.5, shortfall: 0.5 }, 5, "Sick")!.headline).toBe(
      "Over balance by 0.5 days",
    );
  });

  it("no balance record and a negative balance never promise an override", () => {
    const none = balanceText({ kind: "no_balance_record" }, 3, "Vacation")!;
    expect(none.headline).toBe("No balance record");
    expect(none.detail).toContain("Ask HR to set it up");
    expect(none.detail).not.toContain("Waiting for HR override");

    const negative = balanceText({ kind: "negative", balance: -2 }, 3, "Vacation")!;
    expect(negative.headline).toBe("Balance is negative");
    expect(negative.detail).toContain("−2 days");
    expect(negative.detail).not.toContain("Waiting for HR override");
  });
});
