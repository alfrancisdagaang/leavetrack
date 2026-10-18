import { describe, expect, it } from "vitest";
import { leaveTypeLook } from "@/components/ui/leave-type-icon";

describe("leaveTypeLook", () => {
  it("uses the same three icons as the dashboard's summary cards", () => {
    expect(leaveTypeLook("Vacation").icon).toBe("/icons/sun.svg");
    expect(leaveTypeLook("Sick").icon).toBe("/icons/heart-pulse.svg");
    expect(leaveTypeLook("Unpaid").icon).toBe("/icons/calendar-minus.svg");
  });

  it("ignores case and spaces in the name", () => {
    expect(leaveTypeLook("  vacation ").icon).toBe("/icons/sun.svg");
  });

  it("falls back to a neutral look for an unknown type", () => {
    expect(leaveTypeLook("Parental")).toEqual({
      icon: "/icons/calendar-minus.svg",
      tint: "bg-grey-100",
    });
  });
});
