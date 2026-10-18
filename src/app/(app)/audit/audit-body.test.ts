import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditListQuery } from "@/lib/leave/schemas";

const list = vi.hoisted(() => ({ getAuditFilterChoices: vi.fn(), getAuditPage: vi.fn() }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: () => {},
  useRouter: () => ({ push: () => {} }),
}));
vi.mock("@/lib/db/timed", () => ({ timedRead: (_n: string, fn: () => unknown) => fn() }));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => ({ sql: true }) }));
vi.mock("@/lib/leave/audit-list", () => list);
vi.mock("@/lib/logger", () => ({ logger: { warn: () => {} } }));

const { AuditBody } = await import("./audit-body");

const NONE: AuditListQuery = {
  q: undefined,
  leaveTypeId: undefined,
  status: undefined,
  decidedBy: undefined,
  from: undefined,
  to: undefined,
  page: 1,
};
const choices = { leaveTypes: [], deciders: [], employeeNames: [] };
const counts = { total: 0, approved: 0, rejected: 0, pending: 0, deleted: 0 };
const row = {
  id: "r1",
  employeeId: "e1",
  employeeName: "Elena Cruz",
  employeeRole: "employee",
  leaveTypeName: "Vacation",
  startDate: "2026-11-02",
  endDate: "2026-11-04",
  workingDays: 3,
  status: "approved",
  isDeleted: false,
  decidedByName: "Marco Santos",
  decidedByRole: "manager",
  decidedAt: "2026-10-18T09:12:00+00:00",
  createdAt: "2026-10-17T08:00:00+00:00",
};
const html = async (query: AuditListQuery) =>
  renderToStaticMarkup((await AuditBody({ query })) as ReactElement);

beforeEach(() => {
  vi.clearAllMocks();
  list.getAuditFilterChoices.mockResolvedValue(choices);
});

describe("AuditBody (US-14)", () => {
  it("reads the page for the parsed filters", async () => {
    list.getAuditPage.mockResolvedValue({
      counts: { ...counts, total: 1, approved: 1 },
      rows: [row],
      page: 1,
    });
    const query = { ...NONE, q: "elena" };
    const out = await html(query);
    expect(list.getAuditPage).toHaveBeenCalledWith({ sql: true }, query);
    expect(out).toContain("1 request");
    expect(out).toContain("Elena Cruz");
  });

  it("with no requests at all: the empty state; with filters: no matches and a way to clear them", async () => {
    list.getAuditPage.mockResolvedValue({ counts, rows: [], page: 1 });
    expect(await html(NONE)).toContain("There are no leave requests yet.");
    const filtered = await html({ ...NONE, status: "pending" });
    expect(filtered).toContain("No requests match these filters.");
    expect(filtered).toContain('href="/audit"');
  });

  it("a failed read shows an alert with a retry for the same page, not an error page", async () => {
    list.getAuditPage.mockRejectedValue(new Error("boom"));
    const out = await html({ ...NONE, q: "elena", page: 2 });
    expect(out).toContain('role="alert"');
    expect(out).toContain('href="/audit?q=elena&amp;page=2"');
  });

  it("shows pagination with the match count when there is more than one page", async () => {
    list.getAuditPage.mockResolvedValue({
      counts: { ...counts, total: 60, approved: 60 },
      rows: [row],
      page: 2,
    });
    const out = await html({ ...NONE, page: 2 });
    expect(out).toContain("Showing 26 to 50 of 60");
    expect(out).toContain('href="/audit"');
    expect(out).toContain('href="/audit?page=3"');
  });
});
