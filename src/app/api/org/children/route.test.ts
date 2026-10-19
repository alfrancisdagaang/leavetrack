import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/auth/session";
import { MOCK_USERS } from "@/lib/mock/users";

vi.mock("@/lib/logger", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { logger: { ...log, child: () => log } };
});

const getSession = vi.fn<() => Promise<Session | null>>();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const getOrgChildren = vi.fn();
const FAKE_SQL = { fake: true };
vi.mock("@/lib/leave/org", () => ({
  getOrgChildren: (...args: unknown[]) => getOrgChildren(...args),
}));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => FAKE_SQL }));

const { GET } = await import("@/app/api/org/children/route");

const PARENT = "00000000-0000-4000-8000-000000000009";
const PAGE = {
  total: 1,
  page: 1,
  pageSize: 50,
  people: [{ id: "x", name: "X", role: "employee", reports: 0 }],
};
const get = (query: string) => GET(new Request(`http://localhost/api/org/children${query}`), {});

beforeEach(() => {
  getSession.mockReset();
  getOrgChildren.mockReset();
  getOrgChildren.mockResolvedValue(PAGE);
});

describe("GET /api/org/children (TASK-063)", () => {
  it("AC3: HR gets the page in the standard envelope, uncached, read for the SESSION user", async () => {
    getSession.mockResolvedValue({ role: "hr_admin", user: MOCK_USERS.hrAdmin });
    const res = await get(`?parent=${PARENT}&page=2`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ success: true, data: PAGE });
    expect(getOrgChildren).toHaveBeenCalledWith(FAKE_SQL, {
      viewerId: MOCK_USERS.hrAdmin.id,
      parentId: PARENT,
      page: 2,
    });
  });

  it("defaults to page 1", async () => {
    getSession.mockResolvedValue({ role: "hr_admin", user: MOCK_USERS.hrAdmin });
    await get(`?parent=${PARENT}`);
    expect(getOrgChildren.mock.calls[0]![1]).toMatchObject({ page: 1 });
  });

  it.each([
    ["employee", MOCK_USERS.employee],
    ["manager", MOCK_USERS.manager],
  ] as const)(
    "AC3: a %s gets 403 in the standard envelope and nothing is read",
    async (role, user) => {
      getSession.mockResolvedValue({ role, user });
      const res = await get(`?parent=${PARENT}`);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("FORBIDDEN");
      expect(getOrgChildren).not.toHaveBeenCalled();
    },
  );

  it("returns 401 without a session and reads nothing", async () => {
    getSession.mockResolvedValue(null);
    const res = await get(`?parent=${PARENT}`);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(getOrgChildren).not.toHaveBeenCalled();
  });

  it.each([
    ["no parent", ""],
    ["a parent that is not a uuid", "?parent=nope"],
    ["page 0", `?parent=${PARENT}&page=0`],
    ["a page that is not a number", `?parent=${PARENT}&page=abc`],
    ["a fractional page", `?parent=${PARENT}&page=1.5`],
    ["a huge page", `?parent=${PARENT}&page=99999999`],
  ])("rejects %s with VALIDATION_ERROR and reads nothing", async (_name, query) => {
    getSession.mockResolvedValue({ role: "hr_admin", user: MOCK_USERS.hrAdmin });
    const res = await get(query);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(getOrgChildren).not.toHaveBeenCalled();
  });

  it("ignores a client-sent viewer or manager id: the viewer is always the session user", async () => {
    getSession.mockResolvedValue({ role: "hr_admin", user: MOCK_USERS.hrAdmin });
    await get(`?parent=${PARENT}&viewerId=${MOCK_USERS.employee.id}&manager_id=${PARENT}`);
    expect(getOrgChildren.mock.calls[0]![1]).toMatchObject({ viewerId: MOCK_USERS.hrAdmin.id });
  });
});
