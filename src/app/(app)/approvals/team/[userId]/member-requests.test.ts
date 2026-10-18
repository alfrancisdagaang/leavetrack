import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MemberRequest } from "@/lib/leave/team-member";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const { MemberRequests } = await import("./member-requests");

const req = (over: Partial<MemberRequest> = {}): MemberRequest => ({
  id: "r1",
  leaveTypeId: "t1",
  leaveTypeName: "Vacation",
  startDate: "2026-03-02",
  endDate: "2026-03-04",
  workingDays: 3,
  status: "approved",
  decisionNote: null,
  reason: null,
  insufficient: false,
  ...over,
});
const REQUESTS = [
  req({
    id: "p",
    status: "pending",
    reason: "Family trip",
    leaveTypeName: "Sick",
    startDate: "2026-05-04",
    endDate: "2026-05-05",
    workingDays: 2,
  }),
  req({ id: "a" }),
  req({
    id: "x",
    status: "rejected",
    decisionNote: "Not this week",
    startDate: "2026-06-01",
    endDate: "2026-06-02",
    workingDays: 2,
  }),
];
const html = (requests: MemberRequest[] = REQUESTS, total = requests.length) =>
  renderToStaticMarkup(MemberRequests({ requests, total }));
const count = (text: string, needle: string) => text.split(needle).length - 1;

describe("MemberRequests table (US-13 AC1, AC4)", () => {
  const out = html();
  const table = out.slice(out.indexOf("<table"), out.indexOf("</table>"));

  it("is a real table with a name, from the sm breakpoint, with four column headers and row headers", () => {
    expect(out).toMatch(/<table [^>]*class="hidden w-full text-left sm:table"/);
    expect(table).toContain('aria-label="Team member&#x27;s leave requests"');
    for (const header of ["Leave type", "Date range", "Working days", "Status"]) {
      expect(table).toMatch(new RegExp(`<th scope="col"[^>]*>${header}</th>`));
    }
    expect(count(table, '<th scope="row"')).toBe(3);
  });

  it("shows the dates, working days and the status written out", () => {
    expect(table).toContain("2026-03-02 to 2026-03-04");
    expect(table).toContain("3 days");
    for (const status of ["Pending", "Approved", "Rejected"])
      expect(table).toContain(`>${status}<`);
  });

  it("shows the employee's reason for the PENDING request only", () => {
    expect(table).toContain("Reason: Family trip");
    expect(count(table, "Reason:")).toBe(1);
  });

  it("never shows a reason on a decided request, even if one were passed in (defence in depth)", () => {
    const leaky = html([
      req({ id: "d", status: "approved", reason: "Medical detail" }),
      req({ id: "r", status: "rejected", reason: "Another secret", decisionNote: "No" }),
    ]);
    expect(leaky).not.toContain("Medical detail");
    expect(leaky).not.toContain("Another secret");
  });

  it("shows a rejection's own note, labelled as the rejection note", () => {
    expect(table).toContain("Rejection note: Not this week");
  });

  it("offers Approve and Reject only on pending requests (US-13 AC5)", () => {
    expect(count(table, ">Approve<")).toBe(1);
    expect(count(table, ">Reject<")).toBe(1);
  });
});

describe("MemberRequests: a request the balance cannot cover", () => {
  it("says it cannot be approved and disables Approve, leaving Reject available", () => {
    const out = html([req({ id: "p", status: "pending", insufficient: true, reason: "Trip" })]);
    expect(out).toContain("Cannot be approved: not enough balance.");
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Approve/);
    expect(out).toContain(">Reject<");
  });
});

describe("MemberRequests stacked list (phones)", () => {
  const out = html();
  const list = out.slice(out.indexOf("<ul"), out.indexOf("</ul>"));

  it("is a list with the same rows, shown only below sm, so the table is never switched to block", () => {
    expect(out).toMatch(/<ul [^>]*class="divide-y divide-line sm:hidden"/);
    expect(count(list, "<li ")).toBe(3);
  });

  it("shows type, dates, working days, status, reason and note", () => {
    expect(list).toContain("2026-06-01 to 2026-06-02 · 2 days");
    expect(list).toContain("Reason: Family trip");
    expect(list).toContain("Rejection note: Not this week");
    for (const status of ["Pending", "Approved", "Rejected"]) expect(list).toContain(`>${status}<`);
  });
});

describe("MemberRequests header and tokens", () => {
  it("shows the matching count, singular and plural", () => {
    expect(html(REQUESTS, 12)).toContain("12 requests");
    expect(html([req()], 1)).toContain("1 request<");
  });

  it("renders its children (the pagination) under the rows", () => {
    const out = renderToStaticMarkup(
      MemberRequests({ requests: [req()], total: 1, children: "PAGER" }),
    );
    expect(out.indexOf("PAGER")).toBeGreaterThan(out.indexOf("</ul>"));
  });

  it("uses tokens only", () => {
    expect(html()).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(|hsl\(|style="(?!color:transparent")/);
  });
});
