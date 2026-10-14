import { describe, expect, it } from "vitest";
import { initialsOf } from "@/components/ui/initials";

describe("initialsOf", () => {
  it("uses the first and last word", () => {
    expect(initialsOf("Marco Santos")).toBe("MS");
    expect(initialsOf("  ana maria  de la cruz ")).toBe("AC");
  });

  it("handles a single word and an empty name", () => {
    expect(initialsOf("Priya")).toBe("P");
    expect(initialsOf("   ")).toBe("?");
  });
});
