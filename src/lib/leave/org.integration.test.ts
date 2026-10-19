import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getEmployeeOrg,
  getManagerOrg,
  getOrgChildren,
  getOrgRoots,
  ORG_MANAGER_CAP,
  ORG_PAGE_SIZE,
} from "@/lib/leave/org";

/**
 * EPIC-11 (TASK-063) against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at a
 * THROWAWAY database with the migrations applied (no seed): the test inserts its own people, which are
 * never deleted. Every person is created here with a random id, and each read is judged on ids this file
 * planted, so other rows cannot change a result (the roots read is the one global read: its root sorts
 * first by name). The tests share state and run in order: the last one moves a person.
 *
 *   rootT ── hr (hr_admin), mgrA, mgrB, mgrBig, filler 1..51            (55 people under rootT)
 *   mgrA  ── a1, a2, subM (── s1, s2), d1 ─ d2 ─ d3 ─ d4 ─ d5 ─ d6 ─ d7 (a chain: d7 is depth 7)
 *   mgrB  ── b1                                                          (another team)
 *   mgrBig ── 210 employees                                              (over the 200 cap)
 *   cyc1 ⇄ cyc2 (each manages the other), cyc2 ── cyc3                   (a loop in the data)
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("organization reads (EPIC-11 TASK-063, real database)", () => {
  let statements = 0;
  const sql = postgres(url ?? "", {
    prepare: false,
    max: 1,
    onnotice: () => {},
    debug: () => {
      statements += 1;
    },
  });
  const id = () => randomUUID();
  const rootT = id();
  const hr = id();
  const mgrA = id();
  const mgrB = id();
  const mgrBig = id();
  const a1 = id();
  const a2 = id();
  const subM = id();
  const s1 = id();
  const s2 = id();
  const b1 = id();
  const chain = Array.from({ length: 7 }, id); // d1..d7
  const cyc1 = id();
  const cyc2 = id();
  const cyc3 = id();
  const stranger = id(); // not in the database

  async function user(uid: string, name: string, role: string, manager: string | null) {
    await sql`
      insert into public.users (id, name, email, role, manager_id)
      values (${uid}, ${name}, ${`${uid}@test.example`}, ${role}::public.user_role, ${manager})`;
  }
  const ids = (nodes: { id: string }[]) => nodes.map((n) => n.id).sort();

  async function once<T>(run: () => Promise<T>): Promise<T> {
    const before = statements;
    const out = await run();
    expect(statements - before, "each read is ONE statement").toBe(1);
    return out;
  }

  beforeAll(async () => {
    await user(rootT, "Aaa Root", "hr_admin", null);
    await user(hr, "Hr Admin", "hr_admin", rootT);
    await user(mgrA, "Mgr A", "manager", rootT);
    await user(mgrB, "Mgr B", "manager", rootT);
    await user(mgrBig, "Mgr Big", "manager", rootT);
    for (let i = 1; i <= 51; i++)
      await user(id(), `Filler ${String(i).padStart(2, "0")}`, "employee", rootT);
    await user(a1, "A One", "employee", mgrA);
    await user(a2, "A Two", "employee", mgrA);
    await user(subM, "Sub Manager", "manager", mgrA);
    await user(s1, "S One", "employee", subM);
    await user(s2, "S Two", "employee", subM);
    await user(b1, "B One", "employee", mgrB);
    let up = mgrA;
    for (const [i, d] of chain.entries()) {
      await user(d, `Chain ${i + 1}`, "employee", up);
      up = d;
    }
    await sql`
      insert into public.users (id, name, email, role, manager_id)
      select gen_random_uuid(), 'Big ' || lpad(g::text, 3, '0'),
             gen_random_uuid()::text || '@test.example', 'employee', ${mgrBig}
      from generate_series(1, 210) g`;
    await user(cyc1, "Cyc One", "manager", null);
    await user(cyc2, "Cyc Two", "manager", cyc1);
    await user(cyc3, "Cyc Three", "employee", cyc2);
    await sql`update public.users set manager_id = ${cyc2} where id = ${cyc1}`;
  });

  afterAll(async () => {
    await sql.end();
  });

  describe("AC1: an employee's neighbourhood", () => {
    it("gets exactly their manager, themself and their direct reports, never a peer or another team", async () => {
      const org = await once(() => getEmployeeOrg(sql, a1));
      expect(org?.manager?.id).toBe(mgrA);
      expect(org?.me.id).toBe(a1);
      expect(org?.reports).toEqual([]);
      const seen = JSON.stringify(org);
      for (const other of [a2, b1, mgrB, subM, hr, rootT]) expect(seen).not.toContain(other);
    });

    it("sees their own direct reports (a person with reports)", async () => {
      const org = await getEmployeeOrg(sql, subM);
      expect(ids(org?.reports ?? [])).toEqual([s1, s2].sort());
      expect(org?.me.reports).toBe(2);
      expect(org?.manager?.id).toBe(mgrA);
    });

    it("has no manager above the top of the chart, and nothing for an unknown person", async () => {
      expect((await getEmployeeOrg(sql, rootT))?.manager).toBeNull();
      expect(await getEmployeeOrg(sql, stranger)).toBeNull();
    });

    it("returns only id, name, role and reports", async () => {
      const org = await getEmployeeOrg(sql, a1);
      expect(Object.keys(org?.me ?? {}).sort()).toEqual(["id", "name", "reports", "role"]);
      expect(Object.keys(org?.manager ?? {}).sort()).toEqual(["id", "name", "reports", "role"]);
    });
  });

  describe("AC2: a manager's subtree", () => {
    it("gets everyone under them to depth 6 and nobody outside it", async () => {
      const org = await once(() => getManagerOrg(sql, mgrA));
      const expected = [a1, a2, subM, s1, s2, ...chain.slice(0, 6)];
      expect(ids(org?.people ?? [])).toEqual(expected.sort());
      expect(ids(org?.people ?? [])).not.toContain(chain[6]); // depth 7
      expect(org?.total).toBe(11);
      expect(org?.truncated).toBe(false);
      expect(org?.me.id).toBe(mgrA);
      expect(org?.manager?.id).toBe(rootT);
      const seen = JSON.stringify(org);
      for (const other of [b1, mgrB, hr, mgrBig]) expect(seen).not.toContain(other);
    });

    it("lists a parent before its reports, with the right depth and parent", async () => {
      const org = await getManagerOrg(sql, mgrA);
      const byId = new Map((org?.people ?? []).map((p, i) => [p.id, { ...p, at: i }]));
      expect(byId.get(a1)).toMatchObject({ parentId: mgrA, depth: 1 });
      expect(byId.get(s1)).toMatchObject({ parentId: subM, depth: 2 });
      expect(byId.get(chain[5]!)).toMatchObject({ parentId: chain[4], depth: 6 });
      for (const p of byId.values())
        if (p.depth > 1) expect(byId.get(p.parentId)!.at).toBeLessThan(p.at);
      expect(byId.get(subM)?.reports).toBe(2);
    });

    it("cuts at 200 people and still reports the true total", async () => {
      const org = await once(() => getManagerOrg(sql, mgrBig));
      expect(org?.people).toHaveLength(ORG_MANAGER_CAP);
      expect(org?.total).toBe(210);
      expect(org?.truncated).toBe(true);
      expect(new Set(ids(org?.people ?? [])).size).toBe(ORG_MANAGER_CAP);
    });

    it("gives nothing to someone who is not a manager, and nothing for an unknown person", async () => {
      expect(await getManagerOrg(sql, a1)).toBeNull();
      expect(await getManagerOrg(sql, hr)).toBeNull();
      expect(await getManagerOrg(sql, stranger)).toBeNull();
    });

    it("a manager with nobody under them gets themself and an empty tree", async () => {
      const org = await getManagerOrg(sql, mgrB);
      expect(ids(org?.people ?? [])).toEqual([b1]);
    });
  });

  describe("AC3: HR browses the company, 50 at a time", () => {
    it("the roots include the top of the company, with their report count", async () => {
      const page = await once(() => getOrgRoots(sql, { viewerId: hr }));
      const root = page.people.find((p) => p.id === rootT);
      expect(root).toMatchObject({ name: "Aaa Root", reports: 55 });
    });

    it("children come 50 a page with counts, the last page holds the rest, and a page past the end is clamped", async () => {
      const first = await once(() =>
        getOrgChildren(sql, { viewerId: hr, parentId: rootT, page: 1 }),
      );
      expect(first.total).toBe(55);
      expect(first.people).toHaveLength(ORG_PAGE_SIZE);
      const second = await getOrgChildren(sql, { viewerId: hr, parentId: rootT, page: 2 });
      expect(second.people).toHaveLength(5);
      const past = await getOrgChildren(sql, { viewerId: hr, parentId: rootT, page: 99 });
      expect(past.page).toBe(2);
      expect(ids(past.people)).toEqual(ids(second.people));
      const all = [...first.people, ...second.people];
      expect(new Set(ids(all)).size).toBe(55);
      expect(all.find((p) => p.id === mgrA)?.reports).toBe(4);
      expect(all.find((p) => p.id === mgrBig)?.reports).toBe(210);
    });

    it("an unknown parent is an empty page, the same as a person with no reports", async () => {
      const empty = { total: 0, page: 1, pageSize: ORG_PAGE_SIZE, people: [] };
      expect(await getOrgChildren(sql, { viewerId: hr, parentId: stranger, page: 1 })).toEqual(
        empty,
      );
      expect(await getOrgChildren(sql, { viewerId: hr, parentId: a1, page: 1 })).toEqual(empty);
    });

    it("every HR read gives an employee, a manager and an unknown person nothing, where HR gets something", async () => {
      for (const viewerId of [a1, mgrA, stranger]) {
        const children = await getOrgChildren(sql, { viewerId, parentId: rootT, page: 1 });
        expect(children.people, `children for ${viewerId}`).toEqual([]);
        expect(children.total).toBe(0);
        const roots = await getOrgRoots(sql, { viewerId });
        expect(roots.people, `roots for ${viewerId}`).toEqual([]);
        expect(roots.total).toBe(0);
      }
      expect(
        (await getOrgChildren(sql, { viewerId: hr, parentId: rootT, page: 1 })).people.length,
      ).toBeGreaterThan(0);
    });

    it("returns only id, name, role and reports", async () => {
      const page = await getOrgChildren(sql, { viewerId: hr, parentId: mgrB, page: 1 });
      expect(Object.keys(page.people[0] ?? {}).sort()).toEqual(["id", "name", "reports", "role"]);
    });
  });

  describe("AC4: a loop in the data, and a changed manager", () => {
    it("a loop ends, and each person is returned once", async () => {
      const org = await once(() => getManagerOrg(sql, cyc1));
      expect(ids(org?.people ?? [])).toEqual([cyc2, cyc3].sort());
      expect(org?.total).toBe(2);
      expect(org?.manager?.id).toBe(cyc2); // the loop shows as each being the other's manager
      const other = await getManagerOrg(sql, cyc2);
      expect(ids(other?.people ?? [])).toEqual([cyc1, cyc3].sort());
      expect(other?.total).toBe(2);
    });

    it("moving a person to another manager changes the next read", async () => {
      await sql`update public.users set manager_id = ${mgrB} where id = ${a2}`;
      expect(ids((await getManagerOrg(sql, mgrA))?.people ?? [])).not.toContain(a2);
      expect(ids((await getManagerOrg(sql, mgrB))?.people ?? [])).toContain(a2);
      expect((await getEmployeeOrg(sql, a2))?.manager?.id).toBe(mgrB);
      expect((await getEmployeeOrg(sql, a1))?.manager?.reports).toBe(3);
      const children = await getOrgChildren(sql, { viewerId: hr, parentId: mgrB, page: 1 });
      expect(ids(children.people)).toEqual([a2, b1].sort());
    });
  });
});
