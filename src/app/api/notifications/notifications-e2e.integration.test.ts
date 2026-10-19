import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/auth/session";
import type { User } from "@/lib/db/types";
import type * as ServiceModule from "@/lib/leave/service";

/**
 * EPIC-9 / TASK-057: the whole notification flow through the REAL route handlers, services and SQL
 * on a real database. Only two things are replaced: who is signed in (`getSession`) and the
 * database handle (`requireDb`). Skipped unless TEST_DATABASE_URL is set; point it at a THROWAWAY
 * database (requests, audit rows and notifications cannot be deleted). Every person here is created
 * by this file and every read is scoped to them, so other gated files can run beside it, EXCEPT
 * `override-count.integration`: this file inserts over-balance requests, which move that file's
 * HR-wide count.
 */
const url = process.env.TEST_DATABASE_URL;

const holder = vi.hoisted(() => ({ sql: undefined as unknown, session: null as unknown }));

vi.mock("@/lib/logger", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { logger: { ...log, child: () => log } };
});
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => holder.session }));
vi.mock("@/lib/leave/service", async (importOriginal) => ({
  ...(await importOriginal<typeof ServiceModule>()),
  requireDb: () => holder.sql,
}));

const { POST: submitRoute } = await import("@/app/api/leave-requests/route");
const { POST: decideRoute } = await import("@/app/api/leave-requests/[id]/decision/route");
const { POST: overrideRoute } = await import("@/app/api/leave-requests/[id]/override/route");
const { GET: listRoute } = await import("@/app/api/notifications/route");
const { POST: readRoute } = await import("@/app/api/notifications/read/route");

const VAC = "10000000-0000-4000-8000-000000000001";
const SECRET_REASON = "secret medical detail";
const SECRET_NOTE = "secret decision note";

type Json = { success: boolean; data?: any; error?: { code: string; message: string } }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Listed = { id: string; kind: string; employeeName: string; readAt: string | null };

describe.skipIf(!url)(
  "notifications end to end through the routes (TASK-057, real database)",
  () => {
    const sql = postgres(url ?? "", { prepare: false, max: 4, onnotice: () => {} });
    holder.sql = sql;

    const mk = (name: string, role: User["role"], manager: string | null): User => {
      const id = randomUUID();
      return { id, name, email: `${id}@test.example`, role, manager_id: manager };
    };
    const hr = mk("E2E HR", "hr_admin", null);
    const marco = mk("E2E Marco", "manager", hr.id);
    const otherMgr = mk("E2E Other Manager", "manager", hr.id);
    const elena = mk("E2E Elena", "employee", marco.id);
    const leo = mk("E2E Leo", "employee", otherMgr.id);
    const short = mk("E2E Short", "employee", marco.id);

    /** Every response of the two notification routes, to prove no secret ever appears in them. */
    const seen: string[] = [];
    const requestIds: string[] = [];

    const as = (u: User | null) => {
      holder.session = u ? ({ role: u.role, user: u } satisfies Session) : null;
    };
    const json = async (res: Response): Promise<Json> => (await res.json()) as Json;
    const post = (path: string, body: unknown) =>
      new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

    async function submit(u: User, start: string, end: string) {
      as(u);
      const res = await submitRoute(
        post("/api/leave-requests", {
          leave_type_id: VAC,
          start_date: start,
          end_date: end,
          reason: SECRET_REASON,
        }),
        {},
      );
      expect(res.status).toBe(201);
      const id = (await json(res)).data.request.id as string;
      requestIds.push(id);
      return id;
    }
    const decide = async (u: User, id: string, body: unknown) => {
      as(u);
      return decideRoute(post(`/api/leave-requests/${id}/decision`, body), ctx(id));
    };
    async function list(u: User) {
      as(u);
      const res = await listRoute(new Request("http://localhost/api/notifications"), {});
      expect(res.status).toBe(200);
      const text = await res.text();
      seen.push(text);
      const data = (JSON.parse(text) as Json).data as { unread: number; notifications: Listed[] };
      return data;
    }
    async function markRead(u: User, body: unknown) {
      as(u);
      const res = await readRoute(post("/api/notifications/read", body), {});
      expect(res.status).toBe(200);
      const text = await res.text();
      seen.push(text);
      return (JSON.parse(text) as Json).data as { marked: number; unread: number };
    }
    const kinds = (l: { notifications: Listed[] }) => l.notifications.map((n) => n.kind).sort();

    let elenaFirst = "";
    let shortRequest = "";

    beforeAll(async () => {
      for (const u of [hr, marco, otherMgr, elena, leo, short]) {
        await sql`
        insert into public.users (id, name, email, role, manager_id)
        values (${u.id}, ${u.name}, ${u.email}, ${u.role}::public.user_role, ${u.manager_id})`;
      }
      await sql`
      insert into public.leave_balances (user_id, leave_type_id, balance) values
        (${elena.id}, ${VAC}, 10), (${leo.id}, ${VAC}, 10), (${short.id}, ${VAC}, 1)`;
    });
    beforeEach(() => as(null));
    afterAll(async () => {
      await sql.end();
    });

    it("AC1: Elena submits, and only her manager Marco is notified", async () => {
      elenaFirst = await submit(elena, "2026-12-07", "2026-12-08");
      const m = await list(marco);
      expect(m.unread).toBe(1);
      expect(m.notifications).toHaveLength(1);
      expect(m.notifications[0]).toMatchObject({ kind: "submitted", employeeName: "E2E Elena" });
      for (const u of [elena, leo, otherMgr, hr, short]) {
        expect(await list(u)).toEqual({ unread: 0, notifications: [] });
      }
    });

    it("AC1: Leo (another team) submits, and only his own manager hears; Marco's list is unchanged", async () => {
      await submit(leo, "2026-12-07", "2026-12-08");
      const o = await list(otherMgr);
      expect(kinds(o)).toEqual(["submitted"]);
      expect(o.notifications[0]!.employeeName).toBe("E2E Leo");
      const m = await list(marco);
      expect(m.unread).toBe(1);
      expect(m.notifications.map((n) => n.employeeName)).toEqual(["E2E Elena"]);
    });

    it("AC1: Marco approves and rejects, and only Elena is told; Marco's own count does not move", async () => {
      expect((await decide(marco, elenaFirst, { decision: "approve" })).status).toBe(200);
      const second = await submit(elena, "2026-12-14", "2026-12-15");
      const rejected = await decide(marco, second, { decision: "reject", note: SECRET_NOTE });
      expect(rejected.status).toBe(200);

      expect(kinds(await list(elena))).toEqual(["approved", "rejected"]);
      // Marco: two submitted so far (Elena twice), his own actions told nobody else.
      expect(kinds(await list(marco))).toEqual(["submitted", "submitted"]);
      for (const u of [leo, hr, short]) expect((await list(u)).unread).toBe(0);
    });

    it("AC1: an over-balance request is refused by its manager (no notification), then HR overrides: the employee and Marco are told, HR is not", async () => {
      shortRequest = await submit(short, "2026-12-07", "2026-12-09"); // 3 days against 1
      const refused = await decide(marco, shortRequest, { decision: "approve" });
      expect(refused.status).toBe(409);
      expect((await json(refused)).error?.code).toBe("CONFLICT");
      expect(await list(short)).toEqual({ unread: 0, notifications: [] });

      as(hr);
      const res = await overrideRoute(
        post(`/api/leave-requests/${shortRequest}/override`, { decision: "approve" }),
        ctx(shortRequest),
      );
      expect(res.status).toBe(200);

      expect(kinds(await list(short))).toEqual(["overridden"]);
      expect(kinds(await list(marco))).toEqual([
        "overridden",
        "submitted",
        "submitted",
        "submitted",
      ]);
      expect((await list(hr)).unread).toBe(0);
    });

    it("AC1: exactly the expected notifications exist for the whole run, nothing extra", async () => {
      const rows = await sql<{ recipient_id: string; kind: string; n: number }[]>`
      select recipient_id, kind, count(*)::int as n from public.notifications
      where leave_request_id = any(${requestIds}::uuid[])
      group by recipient_id, kind`;
      const got = rows.map((r) => `${r.recipient_id}:${r.kind}:${r.n}`).sort();
      const want = [
        `${marco.id}:submitted:3`,
        `${marco.id}:overridden:1`,
        `${otherMgr.id}:submitted:1`,
        `${elena.id}:approved:1`,
        `${elena.id}:rejected:1`,
        `${short.id}:overridden:1`,
      ].sort();
      expect(got).toEqual(want);
    });

    it("AC2: a user from another team sees none of it, and cannot mark any of it", async () => {
      const marcoList = await list(marco);
      const elenaList = await list(elena);
      const shortList = await list(short);
      const foreign = new Set(
        [...marcoList.notifications, ...elenaList.notifications, ...shortList.notifications].map(
          (n) => n.id,
        ),
      );
      expect(foreign.size).toBe(4 + 2 + 1);

      for (const stranger of [leo, otherMgr]) {
        const theirs = await list(stranger);
        expect(theirs.notifications.some((n) => foreign.has(n.id))).toBe(false);
      }
      // Leo owns nothing: a single foreign id, and mark-all, both change nothing.
      expect(await markRead(leo, { id: marcoList.notifications[0]!.id })).toEqual({
        marked: 0,
        unread: 0,
      });
      expect(await markRead(leo, {})).toEqual({ marked: 0, unread: 0 });
      // The other manager marking all touches only their own single notification.
      expect(await markRead(otherMgr, {})).toEqual({ marked: 1, unread: 0 });

      expect((await list(marco)).unread).toBe(4);
      expect((await list(elena)).unread).toBe(2);
      expect((await list(short)).unread).toBe(1);
      expect((await list(leo)).unread).toBe(0);
    });

    it("the owner marks one by id, then all; nobody else's count moves", async () => {
      const m = await list(marco);
      expect(await markRead(marco, { id: m.notifications[0]!.id })).toEqual({
        marked: 1,
        unread: 3,
      });
      expect(await markRead(marco, {})).toEqual({ marked: 3, unread: 0 });
      expect((await list(marco)).notifications.every((n) => n.readAt !== null)).toBe(true);
      expect((await list(elena)).unread).toBe(2);
      expect((await list(short)).unread).toBe(1);
    });

    it("no reason and no decision note appears in any notification response", () => {
      expect(seen.length).toBeGreaterThan(10);
      const all = seen.join("\n");
      expect(all).not.toContain(SECRET_REASON);
      expect(all).not.toContain(SECRET_NOTE);
    });

    it("without a session both notification routes answer 401 in the standard envelope", async () => {
      as(null);
      const a = await listRoute(new Request("http://localhost/api/notifications"), {});
      const b = await readRoute(post("/api/notifications/read", {}), {});
      for (const res of [a, b]) {
        expect(res.status).toBe(401);
        expect(await json(res)).toEqual({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required." },
        });
      }
    });
  },
);
