import { describe, expect, it } from "vitest";
import {
  cutNote,
  notShownLabel,
  reportsLabel,
  rootsNote,
  showMoreLabel,
  toggleLabel,
} from "./org-text";

describe("org-text (TASK-064)", () => {
  it("says how many direct reports someone has", () => {
    expect(reportsLabel(0)).toBe("No direct reports");
    expect(reportsLabel(1)).toBe("1 direct report");
    expect(reportsLabel(7)).toBe("7 direct reports");
  });

  it("names what the HR button opens and for whom, and flips when open", () => {
    expect(toggleLabel("Sam Okafor", 1, false)).toBe("Show 1 report of Sam Okafor");
    expect(toggleLabel("Hana Reyes", 2, false)).toBe("Show 2 reports of Hana Reyes");
    expect(toggleLabel("Hana Reyes", 2, true)).toBe("Hide 2 reports of Hana Reyes");
  });

  it("writes the notes for a cut list, for many roots and for reports not shown", () => {
    expect(cutNote(200, 250)).toBe("Showing 200 of 250 people under you.");
    expect(rootsNote(50, 61)).toBe("Showing 50 of 61 people at the top of the company.");
    expect(notShownLabel(1)).toBe("1 report not shown");
    expect(notShownLabel(4)).toBe("4 reports not shown");
  });

  it("offers at most one page more", () => {
    expect(showMoreLabel(120, 50)).toBe("Show 50 more");
    expect(showMoreLabel(5, 50)).toBe("Show 5 more");
  });
});
