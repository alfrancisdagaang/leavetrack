import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/auth/session";
import type { User } from "@/lib/db/types";
import type * as ServiceModule from "@/lib/leave/service";

/**
 * EPIC-11 / TASK-066: the organization data of My Profile end to end on a real database. The Overview
 * and Organization sections are the real server components (real reads, real SQL, rendered to HTML) and
 * the HR children route is the real route handler. Only two things are replaced: who is signed in
 * (`getSession`) and the database handle (`requireDb`). Skipped unless TEST_DATABASE_URL is set; point it
 * at a THROWAWAY database with the migrations applied (people are never deleted). Every person is created
 * here with a random id and judged by name, so other gated files can run beside it. The organization
 * follows the demo rule (HR Admins and managers have no manager; employees report to a manager):
 *
 *   hrE, samE (hr_admin)    marco ── elena, jun ── c1 ─ c2 ─ c3 ─ c4 ─ c5 ─ c6 ─ c7 (a chain: c7 is depth 8)
 *   priya ── leo, rep 01..55                       (another team; 56 people under her)
 *   cyc1 ⇄ cyc2 (managers who manage each other), cyc2 ── cyc3   (a loop in the data)
 */
const url = process.env.TEST_DATABASE_URL;

const holder = vi.hoisted(() => ({ sql: undefined as unknown, session: null as unknown }));

vi.mock("@/lib/logger", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { logger: { ...log, child: () => log } };
});
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: () => {} }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => holder.session }));
vi.mock("@/lib/leave/service", async (importOriginal) => ({
  ...(await importOriginal<typeof ServiceModule>()),
  requireDb: () => holder.sql,
}));

const { getManagerOrg } = await import("@/lib/leave/org");
const { GET: childrenRoute } = await import("@/app/api/org/children/route");
const { OrgSection } = await import("@/app/(app)/profile/organization/org-section");
const { OverviewSection } = await import("@/app/(app)/profile/overview-section");

type Json = { success: boolean; data?: any; error?: { code: string; message: string } }; // eslint-disable-line @typescript-eslint/no-explicit-any

describe.skipIf(!url)("My Profile organization end to end (TASK-066, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 4, onnotice: () => {} });
  holder.sql = sql;

  const at = (list: User[], i: number): User => {
    const u = list[i];
    if (!u) throw new Error(`no person at ${i}`);
    return u;
  };
  const mk = (name: string, role: User["role"], manager: string | null): User => {
    const id = randomUUID();
    return { id, name, email: `${id}@test.example`, role, manager_id: manager };
  };
  const hrE = mk("Aaa E2E Hr", "hr_admin", null);
  const samE = mk("Aaa E2E Sam", "hr_admin", null);
  const marco = mk("Aaa E2E Marco", "manager", null);
  const priya = mk("Aaa E2E Priya", "manager", null);
  const elena = mk("E2E Elena", "employee", marco.id);
  const jun = mk("E2E Jun", "employee", marco.id);
  const leo = mk("E2E Leo", "employee", priya.id);
  const chain = Array.from({ length: 7 }, (_, i) => mk(`E2E Chain ${i + 1}`, "employee", null));
  chain.forEach((c, i) => (c.manager_id = i === 0 ? jun.id : at(chain, i - 1).id));
  const reps = Array.from({ length: 55 }, (_, i) =>
    mk(`E2E Rep ${String(i + 1).padStart(2, "0")}`, "employee", priya.id),
  );
  const cyc1 = mk("E2E Cyc One", "manager", null);
  const cyc2 = mk("E2E Cyc Two", "manager", cyc1.id);
  const cyc3 = mk("E2E Cyc Three", "employee", cyc2.id);

  const as = (u: User | null) => {
    holder.session = u ? ({ role: u.role, user: u } satisfies Session) : null;
  };
  const org = async (u: User) =>
    renderToStaticMarkup(
      await OrgSection({ role: u.role, viewer: { id: u.id, name: u.name, email: u.email } }),
    );
  const overview = async (u: User) => renderToStaticMarkup(await OverviewSection({ userId: u.id }));
  const children = async (u: User | null, query: string) => {
    as(u);
    const res = await childrenRoute(new Request(`http://localhost/api/org/children${query}`), {});
    return { res, json: (await res.json()) as Json };
  };

  beforeAll(async () => {
    for (const u of [hrE, samE, marco, priya, cyc1])
      await sql`insert into public.users (id, name, email, role, manager_id)
                values (${u.id}, ${u.name}, ${u.email}, ${u.role}::public.user_role, null)`;
    for (const u of [elena, jun, leo, ...chain, ...reps, cyc2, cyc3])
      await sql`insert into public.users (id, name, email, role, manager_id)
                values (${u.id}, ${u.name}, ${u.email}, ${u.role}::public.user_role, ${u.manager_id})`;
    await sql`update public.users set manager_id = ${cyc2.id} where id = ${cyc1.id}`;
  });
  afterAll(async () => {
    await sql.end();
  });

  describe("AC1: each role's chart holds exactly the people it should", () => {
    it("an employee sees their manager, themself and their reports, and nobody else", async () => {
      const html = await org(elena);
      expect(html).toContain("E2E Elena");
      expect(html).toContain("Aaa E2E Marco");
      for (const other of [jun, leo, priya, hrE, samE, at(chain, 0), at(reps, 0)])
        expect(html, other.name).not.toContain(other.name);
    });

    it("an employee's Overview names their manager, and a manager's says there is none", async () => {
      expect(await overview(elena)).toContain("Aaa E2E Marco");
      expect(await overview(marco)).toContain("No manager");
      expect(await overview(marco)).not.toContain("Aaa E2E Hr");
    });

    it("a manager sees everyone under them to the depth cap and nobody from another team", async () => {
      const html = await org(marco);
      for (const p of [
        elena,
        jun,
        at(chain, 0),
        at(chain, 1),
        at(chain, 2),
        at(chain, 3),
        at(chain, 4),
      ])
        expect(html, p.name).toContain(p.name);
      expect(html).not.toContain("E2E Chain 6");
      expect(html).not.toContain("E2E Chain 7");
      for (const other of [leo, priya, at(reps, 0), hrE, samE, cyc1])
        expect(html, other.name).not.toContain(other.name);
    });

    it("another team's manager sees only their own team", async () => {
      const html = await org(priya);
      expect(html).toContain("E2E Leo");
      expect(html).toContain("E2E Rep 01");
      for (const other of [elena, jun, marco]) expect(html, other.name).not.toContain(other.name);
    });

    it("an HR Admin sees the roots of the company, themself among them, with no manager above", async () => {
      const html = await org(hrE);
      for (const p of [hrE, samE, marco, priya]) expect(html, p.name).toContain(p.name);
      expect(html).not.toContain("E2E Elena");
    });

    it("the HR route pages a manager's reports 50 at a time and clamps a page past the end", async () => {
      const first = await children(hrE, `?parent=${priya.id}`);
      expect(first.res.status).toBe(200);
      expect(first.res.headers.get("cache-control")).toBe("no-store");
      expect(first.json.data.total).toBe(56);
      expect(first.json.data.people).toHaveLength(50);
      const second = await children(hrE, `?parent=${priya.id}&page=2`);
      expect(second.json.data.people).toHaveLength(6);
      const past = await children(hrE, `?parent=${priya.id}&page=99`);
      expect(past.json.data.page).toBe(2);
      expect(past.json.data.people).toHaveLength(6);
      const names = [...first.json.data.people, ...second.json.data.people].map(
        (p: { id: string }) => p.id,
      );
      expect(new Set(names).size).toBe(56);
      expect(names).not.toContain(elena.id);
    });

    it("nothing about a person leaves except id, name, role and report count", async () => {
      const { json } = await children(hrE, `?parent=${marco.id}`);
      for (const p of json.data.people)
        expect(Object.keys(p).sort()).toEqual(["id", "name", "reports", "role"]);
      const text = JSON.stringify(json);
      expect(text).not.toContain("@test.example");
    });
  });

  describe("scope: who may ask", () => {
    it("a visitor gets 401, an employee and a manager get 403, in the standard envelope", async () => {
      const visitor = await children(null, `?parent=${priya.id}`);
      expect(visitor.res.status).toBe(401);
      for (const u of [elena, marco]) {
        const r = await children(u, `?parent=${priya.id}`);
        expect(r.res.status).toBe(403);
        expect(r.json).toEqual({
          success: false,
          error: { code: "FORBIDDEN", message: "You do not have access to this resource." },
        });
      }
    });

    it("a client-supplied viewer is ignored: only the session decides", async () => {
      const r = await children(elena, `?parent=${priya.id}&viewerId=${hrE.id}`);
      expect(r.res.status).toBe(403);
    });

    it("HR's own session decides, whatever viewer the query names", async () => {
      const r = await children(hrE, `?parent=${priya.id}&viewerId=${elena.id}`);
      expect(r.res.status).toBe(200);
      expect(r.json.data.total).toBe(56);
    });

    it("an unknown parent is an empty page, the same answer as a person with no reports", async () => {
      const unknown = await children(hrE, `?parent=${randomUUID()}`);
      const none = await children(hrE, `?parent=${leo.id}`);
      expect(unknown.res.status).toBe(200);
      expect(unknown.json.data.people).toEqual([]);
      expect(none.json.data.people).toEqual([]);
    });

    it("a malformed parent or page is a 400", async () => {
      expect((await children(hrE, "?parent=nope")).res.status).toBe(400);
      expect((await children(hrE, `?parent=${priya.id}&page=0`)).res.status).toBe(400);
    });

    it("an employee's own read never contains another team even when a manager above is shared", async () => {
      const html = await org(leo);
      expect(html).toContain("Aaa E2E Priya");
      expect(html).not.toContain("E2E Elena");
    });
  });

  describe("AC1: a loop ends, and a moved person changes the next read (runs last)", () => {
    it("a loop in the data is read safely, each person once", async () => {
      const read = await getManagerOrg(sql, cyc1.id);
      const ids = (read?.people ?? []).map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain(cyc3.id);
      expect(ids).not.toContain(cyc1.id);
      expect(await org(cyc1)).toContain("E2E Cyc Three");
    });

    it("moving a person to another manager changes the next read for both teams", async () => {
      await sql`update public.users set manager_id = ${priya.id} where id = ${jun.id}`;
      const marcoHtml = await org(marco);
      const priyaHtml = await org(priya);
      expect(marcoHtml).not.toContain("E2E Jun");
      expect(marcoHtml).not.toContain("E2E Chain 1");
      expect(priyaHtml).toContain("E2E Jun");
      expect(await overview(jun)).toContain("Aaa E2E Priya");
    });
  });
});
