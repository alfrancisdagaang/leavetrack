import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LeaveRequestView } from "@/lib/leave/service";
import { BalanceRequests } from "./balance-requests";

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const NAMES = new Map([
  [VAC, "Vacation"],
  [SICK, "Sick"],
]);

const req = (over: Partial<LeaveRequestView>): LeaveRequestView => ({
  id: "r1",
  leave_type_id: VAC,
  start_date: "2026-03-02",
  end_date: "2026-03-04",
  reason: "",
  status: "approved",
  created_at: new Date("2026-02-20T00:00:00Z"),
  decided_at: null,
  decision_note: null,
  working_days: 3,
  ...over,
});
const REQUESTS = [
  req({ id: "a" }),
  req({
    id: "b",
    leave_type_id: SICK,
    status: "pending",
    working_days: 2,
    start_date: "2026-02-10",
    end_date: "2026-02-11",
  }),
  req({
    id: "c",
    status: "rejected",
    decision_note: "Not this week",
    working_days: 5,
    start_date: "2026-01-15",
    end_date: "2026-01-21",
  }),
];
const html = (requests: LeaveRequestView[] = REQUESTS) =>
  renderToStaticMarkup(BalanceRequests({ requests, typeNames: NAMES }));
const count = (text: string, needle: string) => text.split(needle).length - 1;

describe("BalanceRequests table (R8)", () => {
  const out = html();
  const table = out.slice(out.indexOf("<table"), out.indexOf("</table>"));

  it("is a real table with an accessible name, shown from the sm breakpoint", () => {
    expect(table).toContain('aria-label="My leave requests"');
    expect(out).toMatch(/<table [^>]*class="hidden w-full text-left sm:table"/);
  });

  it("has four column headers and the leave type as the row header", () => {
    for (const header of ["Leave type", "Date range", "Working days", "Status"]) {
      expect(table).toMatch(new RegExp(`<th scope="col"[^>]*>${header}</th>`));
    }
    expect(count(table, '<th scope="row"')).toBe(3);
    expect(table).toMatch(/<th scope="row"[^>]*>Vacation<\/th>/);
    expect(table).toMatch(/<th scope="row"[^>]*>Sick<\/th>/);
  });

  it("shows the dates, the working days and the status written out", () => {
    expect(table).toContain("2026-03-02 to 2026-03-04");
    expect(table).toContain("3 days");
    expect(table).toContain("2 days");
    for (const status of ["Approved", "Pending", "Rejected"])
      expect(table).toContain(`>${status}<`);
  });

  it("shows a rejected request's reason beside its chip, and only for rejected ones", () => {
    expect(table).toContain("Reason: Not this week");
    expect(count(table, "Reason:")).toBe(1);
  });
});

describe("BalanceRequests stacked list (R8: phones)", () => {
  const out = html();
  const list = out.slice(out.indexOf("<ul"), out.indexOf("</ul>"));

  it("is a list with the same rows, shown only below sm, so the table is never switched to block", () => {
    expect(out).toMatch(/<ul [^>]*class="divide-y divide-line sm:hidden"/);
    expect(count(list, "<li ")).toBe(3);
    expect(list).toContain('aria-label="My leave requests"');
  });

  it("shows name and days, the dates, the status and the reason", () => {
    expect(list).toContain("Vacation · 3 days");
    expect(list).toContain("Sick · 2 days");
    expect(list).toContain("2026-01-15 to 2026-01-21");
    expect(list).toContain("Reason: Not this week");
    for (const status of ["Approved", "Pending", "Rejected"]) expect(list).toContain(`>${status}<`);
  });
});

describe("BalanceRequests", () => {
  it("is one card titled My requests", () => {
    expect(html()).toMatch(/<h2[^>]*>My requests<\/h2>/);
  });

  it("says so when there are no requests, with no table or list", () => {
    const out = html([]);
    expect(out).toContain("You have not submitted any requests yet.");
    expect(out).not.toContain("<table");
    expect(out).not.toContain("<ul");
  });

  it("falls back to Leave for a type it does not know", () => {
    const out = html([req({ leave_type_id: "unknown" })]);
    expect(out).toMatch(/<th scope="row"[^>]*>Leave<\/th>/);
  });

  it("uses tokens only", () => {
    expect(html()).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(|hsl\(|style="(?!color:transparent")/);
  });
});
