import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RosterMember } from "@/lib/leave/team-roster";
import { RosterRow } from "./roster-row";

const MEMBER: RosterMember = {
  id: "00000000-0000-4000-8000-000000000003",
  name: "Elena Cruz",
  role: "employee",
  status: { kind: "out_today" },
  pendingCount: 2,
  balances: [
    {
      leaveTypeId: "t1",
      leaveTypeName: "Vacation",
      tracksBalance: true,
      confirmed: 10,
      pending: 2,
      available: 8,
    },
    {
      leaveTypeId: "t2",
      leaveTypeName: "Sick",
      tracksBalance: true,
      confirmed: 7,
      pending: 2,
      available: 5,
    },
  ],
  lastRequest: { leaveTypeName: "Vacation", status: "approved" },
};
const html = (member: RosterMember = MEMBER, href?: string) =>
  renderToStaticMarkup(RosterRow({ member, href }));

describe("RosterRow (US-12 AC2)", () => {
  it("shows the avatar initials, the name and the status as text", () => {
    const out = html();
    expect(out).toContain(">EC<");
    expect(out).toContain("Elena Cruz");
    expect(out).toContain("Out today");
  });

  it("writes the next leave or no leave planned when the person is not out", () => {
    expect(html({ ...MEMBER, status: { kind: "next_leave", start: "2026-11-02" } })).toContain(
      "Next leave: Nov 2",
    );
    expect(html({ ...MEMBER, status: { kind: "none" } })).toContain("No leave planned");
  });

  it("shows the pending count as a pending chip, and a neutral one at zero", () => {
    expect(html()).toMatch(/bg-pending-bg[^>]*>2 pending</);
    const zero = html({ ...MEMBER, pendingCount: 0 });
    expect(zero).toContain("0 pending");
    expect(zero).not.toContain("bg-pending-bg");
  });

  it("shows the days left per tracked type under its name", () => {
    const out = html();
    expect(out).toMatch(/<dt[^>]*>Vacation<\/dt><dd[^>]*>8 days<\/dd>/);
    expect(out).toMatch(/<dt[^>]*>Sick<\/dt><dd[^>]*>5 days<\/dd>/);
  });

  it("shows the last request with its type and its status written out", () => {
    const out = html();
    expect(out).toContain("Last request");
    expect(out).toContain("Vacation");
    expect(out).toContain(">Approved<");
    expect(html({ ...MEMBER, lastRequest: null })).toContain("No requests yet");
  });

  it("is a link with a chevron only when it has somewhere to go", () => {
    expect(html()).not.toContain("<a ");
    expect(html()).not.toContain("chevron-right");
    const linked = html(MEMBER, "/approvals/team/abc");
    expect(linked).toMatch(/<a [^>]*href="\/approvals\/team\/abc"/);
    expect(linked).toContain("chevron-right.svg");
    // The chevron shows on phones too (top right), not only from the sm breakpoint.
    expect(linked).toContain("absolute right-4");
    expect(linked).not.toContain("hidden shrink-0 sm:block");
  });

  it("uses tokens only (no hard-coded colour or inline style)", () => {
    expect(html(MEMBER, "/approvals/team/abc")).not.toMatch(
      /#[0-9a-fA-F]{3,6}\b|rgb\(|hsl\(|style="(?!color:transparent")/,
    );
  });
});
