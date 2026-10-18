import { describe, expect, it } from "vitest";
import { days, formatDay, formatRange, statusBadge, utc } from "./audit-format";

describe("audit format", () => {
  it("writes the zone next to every time", () => {
    expect(utc("2026-10-18T09:12:34Z")).toBe("Oct 18, 2026, 09:12 UTC");
    expect(utc(new Date("2026-10-18T23:59:00Z"))).toBe("Oct 18, 2026, 23:59 UTC");
  });

  it("pluralises working days", () => {
    expect(days(1)).toBe("1 working day");
    expect(days(3)).toBe("3 working days");
  });

  it("writes the status out, and shows a soft-deleted request as removed whatever its status was", () => {
    expect(statusBadge("approved", false).label).toBe("Approved");
    expect(statusBadge("rejected", false).label).toBe("Rejected");
    expect(statusBadge("pending", false).label).toBe("Pending");
    expect(statusBadge("approved", true).label).toBe("Removed (soft-deleted)");
  });

  it("writes a day as month, day and year, with no leading zero", () => {
    expect(formatDay("2026-11-02")).toBe("Nov 2, 2026");
    expect(formatDay("2025-01-12")).toBe("Jan 12, 2025");
  });

  it("writes a range once for one day, shows the year once, or twice across a year", () => {
    expect(formatRange("2026-11-02", "2026-11-02")).toBe("Nov 2, 2026");
    expect(formatRange("2026-11-02", "2026-11-04")).toBe("Nov 2 to Nov 4, 2026");
    expect(formatRange("2026-10-30", "2026-11-02")).toBe("Oct 30 to Nov 2, 2026");
    expect(formatRange("2026-12-30", "2027-01-02")).toBe("Dec 30, 2026 to Jan 2, 2027");
  });
});
