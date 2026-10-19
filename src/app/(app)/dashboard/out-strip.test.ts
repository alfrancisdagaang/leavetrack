import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OutStrip } from "./out-strip";
import { cardsGridClass } from "./skeletons";

const days = [
  { day: "2026-10-21", total: 5, pending: 2 },
  { day: "2026-10-22", total: 0, pending: 0 },
  { day: "2026-10-23", total: 3, pending: 0 },
];
const render = (d = days) =>
  renderToStaticMarkup(createElement(OutStrip, { days: d, today: "2026-10-21" }));

describe("OutStrip (HR dashboard, Next 7 days)", () => {
  it("writes each weekday's count as text, and the pending count as its own line", () => {
    const out = render();
    expect(out).toContain("Wed 21 Oct");
    expect(out).toContain("5 out");
    expect(out).toContain("2 pending");
    expect(out).toContain("3 out");
    expect(out).toContain("0 pending");
  });

  it("opens a day that has people in the Company Calendar, and links the whole calendar", () => {
    const out = render();
    expect(out).toContain('href="/calendar?month=2026-10&amp;day=2026-10-21"');
    expect(out).toContain('href="/calendar?month=2026-10&amp;day=2026-10-23"');
    expect(out).toContain('href="/calendar"');
    expect(out).toContain("Open Company Calendar");
  });

  it("a day nobody is out is not a link and says so", () => {
    const out = render();
    expect(out).toContain("No one out");
    expect(out).not.toContain("day=2026-10-22");
  });

  it("marks today in words and with aria-current", () => {
    const out = render();
    expect(out).toContain(">Today<");
    expect(out.match(/aria-current="date"/g)).toHaveLength(1);
  });

  it("says so when there are no weekdays to show", () => {
    expect(render([])).toContain("There are no weekdays to show.");
  });
});

describe("cardsGridClass", () => {
  it("lets an odd last card take the whole row below xl, so no row has a hole", () => {
    const three = cardsGridClass(3);
    expect(three).toContain("[&>*:last-child:nth-child(odd)]:col-span-2");
    expect(three).toContain("xl:[&>*:last-child:nth-child(odd)]:col-span-1");
    expect(three).toContain("xl:grid-cols-3");
    expect(cardsGridClass(4)).toContain("xl:grid-cols-4");
  });
});
