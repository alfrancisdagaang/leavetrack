import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatTiles } from "./stat-tiles";

const tiles = [
  { icon: "/icons/users-card.svg", tint: "bg-brand-50", value: 1248, label: "employees" },
  {
    icon: "/icons/clock-3.svg",
    tint: "bg-pending-bg",
    value: 7,
    label: "pending",
    href: "/x?status=a",
  },
  {
    icon: "/icons/check.svg",
    tint: "bg-approved-bg",
    value: 0,
    label: "done",
    href: "/x?status=b",
  },
];
const html = renderToStaticMarkup(createElement(StatTiles, { tiles, label: "Team summary" }));

describe("StatTiles", () => {
  it("shows each number with thousands separators and its label, in a labelled region", () => {
    expect(html).toContain("1,248");
    expect(html).toContain(">7<");
    expect(html).toContain(">0<");
    for (const l of ["employees", "pending", "done"]) expect(html).toContain(l);
    expect(html).toContain('aria-label="Team summary"');
  });

  it("only a tile with an href is a link", () => {
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain('href="/x?status=a"');
  });

  it("is three small columns on a phone, with the icon only from sm", () => {
    expect(html).toContain("grid-cols-3");
    expect(html).toContain("hidden size-12");
    expect(html).toContain("sm:flex");
  });

  it("defaults the region label to Summary", () => {
    expect(renderToStaticMarkup(createElement(StatTiles, { tiles }))).toContain(
      'aria-label="Summary"',
    );
  });
});
