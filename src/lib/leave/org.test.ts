import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import {
  getEmployeeOrg,
  getManagerOrg,
  getOrgChildren,
  getOrgRoots,
  ORG_MANAGER_CAP,
  ORG_MAX_DEPTH,
  ORG_PAGE_SIZE,
} from "@/lib/leave/org";

const VIEWER = "00000000-0000-4000-8000-000000000002";
const PARENT = "00000000-0000-4000-8000-000000000009";

/** A fake client that records each statement with its values and answers with one row. */
function fakeSql(row: unknown) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return row === undefined ? [] : [row];
  };
  return { sql: sql as unknown as Sql, calls };
}

const node = (id: string, reports = 0) => ({ id, name: `P ${id}`, role: "employee", reports });

/** The select list of a statement's last select: what a read can return. */
const outputs = (text: string) => text.slice(text.lastIndexOf("select"));

describe("getEmployeeOrg (TASK-063)", () => {
  it("is ONE statement bound to the viewer id only, and never looks a person up by anything else (AC5, AC1)", async () => {
    const { sql, calls } = fakeSql({ manager: null, me: node("me"), reports: [] });
    await getEmployeeOrg(sql, VIEWER);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values).toEqual([VIEWER]);
    // The manager is found through the viewer's own manager_id, so a sibling cannot be selected.
    expect(calls[0]!.text).toContain("join public.users m on m.id = me.manager_id");
  });

  it("returns the manager, the person and the direct reports (AC1)", async () => {
    const { sql } = fakeSql({
      manager: node("boss", 3),
      me: node("me", 1),
      reports: [node("r1")],
    });
    expect(await getEmployeeOrg(sql, VIEWER)).toEqual({
      manager: node("boss", 3),
      me: node("me", 1),
      reports: [node("r1")],
    });
  });

  it("has no manager above someone at the top, and null for an unknown viewer", async () => {
    expect(
      (await getEmployeeOrg(fakeSql({ manager: null, me: node("me"), reports: [] }).sql, VIEWER))
        ?.manager,
    ).toBeNull();
    expect(
      await getEmployeeOrg(fakeSql({ manager: null, me: null, reports: [] }).sql, VIEWER),
    ).toBeNull();
  });

  it("selects only id, name, role and the number of reports: no email, no leave data", async () => {
    const { sql, calls } = fakeSql(undefined);
    await getEmployeeOrg(sql, VIEWER);
    expect(calls[0]!.text).not.toMatch(/email|leave_requests|leave_balances|reason/);
  });
});

describe("getManagerOrg (TASK-063)", () => {
  const row = {
    manager: node("boss"),
    me: node("mgr", 2),
    total: 2,
    people: [
      { ...node("a", 1), parentId: "mgr", depth: 1 },
      { ...node("b"), parentId: "a", depth: 2 },
    ],
  };

  it("is ONE statement bound to the viewer id plus the two caps, and requires the manager role in the SQL (AC5, AC2)", async () => {
    const { sql, calls } = fakeSql(row);
    await getManagerOrg(sql, VIEWER);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values).toEqual([VIEWER, ORG_MAX_DEPTH, ORG_MANAGER_CAP]);
    expect(calls[0]!.text).toMatch(/u\.id = \?::uuid and u\.role = 'manager'/);
  });

  it("walks down manager_id with a cycle guard and a depth cap, and cuts shallowest-first after counting (AC2, AC4)", async () => {
    const { sql, calls } = fakeSql(row);
    await getManagerOrg(sql, VIEWER);
    const text = calls[0]!.text;
    expect(text).toContain("with recursive");
    expect(text).toContain("not (u.id = any (t.path))");
    expect(text).toContain("array[v.id, u.id]");
    expect(text).toMatch(/t\.depth < \?::int/);
    // The total is counted over the whole walk, before the limit is applied.
    expect(text.indexOf("count(*)::int as total from tree")).toBeLessThan(text.indexOf("limit"));
    expect(text).toMatch(/order by depth, name, id limit/);
  });

  it("says when the list was cut and keeps the true total (AC2)", async () => {
    const cut = {
      ...row,
      total: 250,
      people: Array.from({ length: 200 }, () => row.people[0]!),
    };
    const out = await getManagerOrg(fakeSql(cut).sql, VIEWER);
    expect(out?.total).toBe(250);
    expect(out?.people).toHaveLength(200);
    expect(out?.truncated).toBe(true);
    expect((await getManagerOrg(fakeSql(row).sql, VIEWER))?.truncated).toBe(false);
  });

  it("is null for a viewer who is not a manager or does not exist", async () => {
    expect(
      await getManagerOrg(fakeSql({ manager: null, me: null, total: 0, people: [] }).sql, VIEWER),
    ).toBeNull();
  });

  it("selects only id, name, role, parent, depth and the number of reports: no email, no leave data", async () => {
    const { sql, calls } = fakeSql(undefined);
    await getManagerOrg(sql, VIEWER);
    expect(calls[0]!.text).not.toMatch(/email|leave_requests|leave_balances|reason/);
  });
});

describe("getOrgChildren and getOrgRoots (TASK-063)", () => {
  const page = { total: 120, people: [node("a", 2), node("b")] };

  it("is ONE statement; the viewer must be an hr_admin in the SQL; parent and page are only inputs (AC3, AC5)", async () => {
    const { sql, calls } = fakeSql(page);
    await getOrgChildren(sql, { viewerId: VIEWER, parentId: PARENT, page: 2 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).toMatch(/h\.id = \?::uuid and h\.role = 'hr_admin'/);
    expect(calls[0]!.values[0]).toBe(VIEWER);
    expect(calls[0]!.values).toContain(PARENT);
    expect(calls[0]!.values).toContain(ORG_PAGE_SIZE); // the offset step and the limit
  });

  it("clamps the page in SQL and reports the page actually shown (AC3)", async () => {
    const { sql, calls } = fakeSql(page);
    const out = await getOrgChildren(sql, { viewerId: VIEWER, parentId: PARENT, page: 99 });
    expect(calls[0]!.text).toMatch(/least\(\?::int,\s+greatest\(0/);
    expect(out).toEqual({ total: 120, page: 3, pageSize: 50, people: page.people });
  });

  it("an empty answer is page 1 with no people, whoever asked", async () => {
    const out = await getOrgChildren(fakeSql({ total: 0, people: [] }).sql, {
      viewerId: VIEWER,
      parentId: PARENT,
      page: 4,
    });
    expect(out).toEqual({ total: 0, page: 1, pageSize: 50, people: [] });
  });

  it("the roots are the same statement with no parent (manager_id is null) (AC3)", async () => {
    const { sql, calls } = fakeSql(page);
    await getOrgRoots(sql, { viewerId: VIEWER });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values).toContain(null);
    expect(calls[0]!.text).toContain("u.manager_id is null");
  });

  it("selects only id, name, role and the number of reports: no email, no leave data", async () => {
    const { sql, calls } = fakeSql(page);
    await getOrgChildren(sql, { viewerId: VIEWER, parentId: PARENT, page: 1 });
    expect(outputs(calls[0]!.text)).not.toMatch(/email/);
    expect(calls[0]!.text).not.toMatch(/email|leave_requests|leave_balances|reason/);
  });
});
