import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as HrCalendarModule from "@/lib/leave/hr-calendar";
import type { HrCalendarQuery } from "@/lib/leave/schemas";

const reads = vi.hoisted(() => ({
  choices: vi.fn(),
  month: vi.fn(),
  day: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: () => {},
  redirect: () => {},
  useRouter: () => ({ push: () => {} }),
}));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => ({}) }));
vi.mock("@/lib/leave/hr-calendar", async (importOriginal) => ({
  ...(await importOriginal<typeof HrCalendarModule>()),
  getHrCalendarChoices: reads.choices,
  getMonthCounts: reads.month,
  getDayPeople: reads.day,
}));

const { CalendarBody } = await import("./calendar-body");

const query = (over: Partial<HrCalendarQuery> = {}): HrCalendarQuery => ({
  month: undefined,
  managerId: undefined,
  leaveTypeId: undefined,
  day: undefined,
  q: undefined,
  page: 1,
  ...over,
});
const render = async (q: HrCalendarQuery) =>
  renderToStaticMarkup(
    createElement(
      "div",
      null,
      await CalendarBody({ viewerId: "h1", query: q, today: "2026-11-04" }),
    ),
  );

const choices = {
  leaveTypes: [
    { id: "t1", name: "Vacation" },
    { id: "t2", name: "Sick" },
    { id: "t3", name: "Unpaid" },
  ],
  managers: [{ id: "m1", name: "Marco Santos" }],
};
const busyDay = {
  day: "2026-11-04",
  total: 12,
  approved: 10,
  pending: 2,
  byType: [
    { leaveTypeName: "Sick", approved: 2, pending: 1 },
    { leaveTypeName: "Vacation", approved: 8, pending: 1 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  reads.choices.mockResolvedValue(choices);
  reads.month.mockResolvedValue([busyDay]);
  reads.day.mockResolvedValue({ total: 0, page: 1, people: [] });
});

describe("CalendarBody (EPIC-7 TASK-043)", () => {
  it("AC1: shows the number out per day as text, with the types and the pending count", async () => {
    const out = await render(query());
    expect(out).toContain("12 out");
    expect(out).toContain("Vacation 9 · Sick 3 · Unpaid 0");
    expect(out).toContain("2 pending");
    expect(out).toContain("Today");
    expect(out).toContain("All teams");
    expect(out).toContain("Marco Santos");
    expect(out).toContain("Wed 4 Nov 2026");
  });

  it("polish: the month row has Month, the nav, Today (also on the current month), Team, Leave type and Apply", async () => {
    const out = await render(query({ month: "2026-11" }));
    expect(out).toContain(">Month<");
    expect(out).toContain(">Today<");
    expect(out).toContain(">Team<");
    expect(out).toContain(">Leave type<");
    expect(out).toContain(">Apply<");
    expect(out).toContain('aria-current="date"'); // the Today button on the current month
  });

  it("polish: one leave type picked in the filter lists only that type on every day", async () => {
    const out = await render(query({ leaveTypeId: "t2" }));
    expect(out).toContain("Sick 3");
    expect(out).not.toContain("Unpaid 0");
  });

  it("polish: the open day has an icon Close, the summary tiles, a search and a header row", async () => {
    reads.day.mockResolvedValue({
      total: 1,
      page: 1,
      people: [
        {
          requestId: "r1",
          userId: "u1",
          name: "Elena Cruz",
          managerName: null,
          leaveTypeName: "Vacation",
          startDate: "2026-11-04",
          endDate: "2026-11-04",
          status: "approved",
        },
      ],
    });
    const out = await render(query({ day: "2026-11-04" }));
    expect(out).toContain('aria-label="Close"');
    expect(out).toContain('aria-label="People out by leave type"');
    expect(out).toMatch(/Vacation<\/span><span[^>]*>9</);
    expect(out).toMatch(/Pending<\/span><span[^>]*>2</);
    expect(out).toContain("Name · Team");
    expect(out).toContain("Leave type · Dates");
    expect(out).toContain('type="search"');
    expect(out).toContain("No manager");
  });

  it("AC1: reads the month asked for, with the filters from the address", async () => {
    await render(query({ month: "2026-12", managerId: "m1", leaveTypeId: "t1" }));
    expect(reads.month).toHaveBeenCalledWith(expect.anything(), {
      viewerId: "h1",
      from: "2026-12-01",
      to: "2026-12-31",
      managerId: "m1",
      leaveTypeId: "t1",
    });
    expect(reads.day).not.toHaveBeenCalled();
  });

  it("AC2: opening a day lists who is out, with the page and the search it was given", async () => {
    reads.day.mockResolvedValue({
      total: 26,
      page: 2,
      people: [
        {
          requestId: "r1",
          userId: "u1",
          name: "Elena Cruz",
          managerName: "Marco Santos",
          leaveTypeName: "Vacation",
          startDate: "2026-11-02",
          endDate: "2026-11-06",
          status: "pending",
        },
      ],
    });
    const out = await render(query({ day: "2026-11-04", q: "elena", page: 2 }));
    expect(reads.day).toHaveBeenCalledWith(expect.anything(), {
      viewerId: "h1",
      day: "2026-11-04",
      q: "elena",
      page: 2,
      managerId: undefined,
      leaveTypeId: undefined,
    });
    expect(out).toContain("Wed 4 Nov 2026 · 12 people out");
    expect(out).toContain("26 requests match this name");
    expect(out).toContain("Elena Cruz");
    expect(out).toContain("Team: Marco Santos");
    expect(out).toContain("Pending");
    expect(out).toContain("Showing 26 to 26 of 26");
    expect(out).toContain('name="q"');
    expect(out).not.toContain("reason");
  });

  it("AC4: an empty month says so, with no grid", async () => {
    reads.month.mockResolvedValue([]);
    const out = await render(query());
    expect(out).toContain("Nobody is out this month.");
    expect(out).not.toContain("No one out");
  });

  it("AC4: an empty month under filters offers to clear them", async () => {
    reads.month.mockResolvedValue([]);
    const out = await render(query({ managerId: "m1" }));
    expect(out).toContain("Nobody is out this month with these filters.");
    expect(out).toContain("Clear filters");
  });

  it("AC4: a failed read says so in an alert with a way to retry, and does not throw", async () => {
    reads.month.mockRejectedValue(new Error("boom"));
    const out = await render(query({ month: "2026-12" }));
    expect(out).toContain('role="alert"');
    expect(out).toContain("could not be loaded");
    expect(out).toContain('href="/calendar?month=2026-12"');
  });

  it("AC5: a day with people out is a link, and a day with nobody is not", async () => {
    const out = await render(query());
    expect(out).toContain('href="/calendar?day=2026-11-04"');
    expect(out).not.toContain('href="/calendar?day=2026-11-05"');
  });
});
