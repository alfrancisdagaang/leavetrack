import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/leave/profile";

const svc = vi.hoisted(() => ({ getProfile: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => ({}) }));
vi.mock("@/lib/leave/profile", () => ({ getProfile: svc.getProfile }));

const { OverviewSection } = await import("./overview-section");

const ELENA: Profile = {
  id: "u1",
  name: "Elena Cruz",
  email: "elena.cruz@leavetrack.example",
  role: "employee",
  managerName: "Marco Santos",
};

const render = async (userId = "u1") => renderToStaticMarkup(await OverviewSection({ userId }));

beforeEach(() => {
  svc.getProfile.mockReset();
});

describe("OverviewSection (TASK-062)", () => {
  it("shows the name, role in words, email and manager's name (AC1)", async () => {
    svc.getProfile.mockResolvedValue(ELENA);
    const html = await render();
    expect(html).toContain("Elena Cruz");
    expect(html).toContain("Employee");
    expect(html).toContain("elena.cruz@leavetrack.example");
    expect(html).toContain("Marco Santos");
    expect(html).toContain(">EC<");
  });

  it.each([
    ["manager", "Manager"],
    ["hr_admin", "HR Admin"],
  ] as const)("writes the %s role as %s", async (role, label) => {
    svc.getProfile.mockResolvedValue({ ...ELENA, role });
    expect(await render()).toContain(label);
  });

  it("reads 'No manager' for someone at the top of the chart (AC2)", async () => {
    svc.getProfile.mockResolvedValue({ ...ELENA, managerName: null });
    expect(await render()).toContain("No manager");
  });

  it("reads for the id it was given, in one call (AC3)", async () => {
    svc.getProfile.mockResolvedValue(ELENA);
    await render("u-session");
    expect(svc.getProfile).toHaveBeenCalledTimes(1);
    expect(svc.getProfile.mock.calls[0]![1]).toBe("u-session");
  });

  it("says so, with an alert and a way to retry, when the read fails (AC3)", async () => {
    svc.getProfile.mockRejectedValue(new Error("boom"));
    const html = await render();
    expect(html).toContain('role="alert"');
    expect(html).toContain("could not be loaded");
    expect(html).toContain('href="/profile"');
    expect(html).not.toContain("Elena Cruz");
  });

  it("says the same when the person is not found", async () => {
    svc.getProfile.mockResolvedValue(null);
    expect(await render()).toContain('role="alert"');
  });

  it("wraps a long unbroken name and email instead of widening the page (AC4)", async () => {
    svc.getProfile.mockResolvedValue({
      ...ELENA,
      name: "A".repeat(120),
      email: `${"b".repeat(90)}@x.example`,
    });
    const html = await render();
    expect(html).toContain("[overflow-wrap:anywhere]");
    expect(html).toMatch(/break-words/);
  });

  it("has no department, job title, photo or link to another person's profile", async () => {
    svc.getProfile.mockResolvedValue(ELENA);
    const html = await render();
    expect(html).not.toMatch(/Department|Job title|<img/i);
    expect(html).not.toContain("<a ");
  });
});
