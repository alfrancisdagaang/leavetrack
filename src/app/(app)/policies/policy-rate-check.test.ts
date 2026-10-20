import { describe, expect, it } from "vitest";
import { isUnchanged, rateProblem } from "./policy-rate-check";

describe("rateProblem (EPIC-13 AC4)", () => {
  it.each(["0", "0.01", "1.25", "1.5", "31", " 2 "])("accepts %j", (v) => {
    expect(rateProblem(v)).toBeNull();
  });
  it.each([
    ["", "Enter a number"],
    ["  ", "Enter a number"],
    ["abc", "Enter a number"],
    ["-0.01", "cannot be negative"],
    ["31.01", "more than 31"],
    ["1.255", "two decimals"],
    ["0.001", "two decimals"],
  ])("%j is refused: %s", (v, text) => {
    expect(rateProblem(v)).toContain(text);
  });
});

describe("isUnchanged", () => {
  it("is the same number, however it is written", () => {
    expect(isUnchanged("1.5", "1.50")).toBe(true);
    expect(isUnchanged("1.50", "1.5")).toBe(true);
    expect(isUnchanged(" 2 ", "2.00")).toBe(true);
    expect(isUnchanged("0", "0.00")).toBe(true);
  });
  it("is different when the number differs", () => {
    expect(isUnchanged("1.51", "1.50")).toBe(false);
    expect(isUnchanged("0", "1.00")).toBe(false);
  });
  it("an empty field is unchanged only when there is no saved rate", () => {
    expect(isUnchanged("", null)).toBe(true);
    expect(isUnchanged("  ", null)).toBe(true);
    expect(isUnchanged("1", null)).toBe(false);
    expect(isUnchanged("", "1.00")).toBe(false);
  });
});
