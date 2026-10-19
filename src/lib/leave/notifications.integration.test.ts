import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  listNotifications,
  markNotificationsRead,
  NOTIFICATION_PAGE_SIZE,
} from "@/lib/leave/notifications";

/**
 * EPIC-9 / TASK-054 against a real database: the list and mark-read queries are scoped to the
 * recipient in SQL. Skipped unless TEST_DATABASE_URL is set; point it at a THROWAWAY database
 * (requests and notifications cannot be deleted). Every person here is created by this file, and
 * every read is scoped to them, so other gated files can run beside it.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const SECRET_REASON = "secret medical detail";
const SECRET_NOTE = "secret decision note";

describe.skipIf(!url)("notification list and mark-read (TASK-054, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 4, onnotice: () => {} });
  const employee = randomUUID();

  async function person(name: string, role = "manager") {
    const id = randomUUID();
    await sql`
      insert into public.users (id, name, email, role)
      values (${id}, ${name}, ${`${id}@test.example`}, ${role}::public.user_role)`;
    return id;
  }
  async function request(over: { deleted?: boolean; rejected?: boolean; by?: string } = {}) {
    const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests
        (user_id, leave_type_id, start_date, end_date, reason, is_deleted, status,
         decided_by, decided_at, decision_note)
      values (${employee}, ${VAC}, date '2026-11-02', date '2026-11-03', ${SECRET_REASON},
              ${over.deleted ?? false}, ${over.rejected ? "rejected" : "pending"}::public.leave_status,
              ${over.rejected ? over.by! : null}, ${over.rejected ? sql`now()` : null},
              ${over.rejected ? SECRET_NOTE : null})
      returning id`;
    return row!.id;
  }
  /** `n` notifications for `to`, `secondsAgo` apart so their order is known (oldest first in the array). */
  async function notes(to: string, requestId: string, n: number) {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const [row] = await sql<{ id: string }[]>`
        insert into public.notifications (recipient_id, kind, leave_request_id, created_at)
        values (${to}, 'submitted', ${requestId}, now() - make_interval(secs => ${n - i}))
        returning id`;
      ids.push(row!.id);
    }
    return ids; // oldest first
  }
  const unreadOf = async (id: string) =>
    (
      await sql<{ n: number }[]>`
        select count(*)::int as n from public.notifications
        where recipient_id = ${id} and read_at is null`
    )[0]!.n;

  beforeAll(async () => {
    await sql`
      insert into public.users (id, name, email, role)
      values (${employee}, 'Test Elena', ${`${employee}@test.example`}, 'employee')`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC1: the list holds only the session user's rows, newest first, capped at 20, with the unread count", async () => {
    const a = await person("Test A");
    const b = await person("Test B");
    const req = await request();
    const aIds = await notes(a, req, 25);
    const bIds = await notes(b, req, 3);

    const result = await listNotifications(sql, a);
    expect(result.unread).toBe(25);
    expect(result.notifications).toHaveLength(NOTIFICATION_PAGE_SIZE);
    // Newest first: the 20 newest of A's 25, in reverse creation order.
    expect(result.notifications.map((n) => n.id)).toEqual(aIds.slice(5).reverse());
    // None of B's rows, and B's own list is B's only.
    const shown = new Set(result.notifications.map((n) => n.id));
    expect(bIds.some((id) => shown.has(id))).toBe(false);
    const other = await listNotifications(sql, b);
    expect(other.unread).toBe(3);
    expect(other.notifications.map((n) => n.id)).toEqual(bIds.reverse());
  });

  it("AC1: a person with nothing gets zero and an empty list", async () => {
    const nobody = await person("Test Nobody");
    expect(await listNotifications(sql, nobody)).toEqual({ unread: 0, notifications: [] });
  });

  it("shows the facts of the request, and never the reason or the decision note", async () => {
    const mgr = await person("Test Mgr");
    const req = await request({ rejected: true, by: mgr });
    await notes(mgr, req, 1);
    const result = await listNotifications(sql, mgr);
    expect(result.notifications[0]).toMatchObject({
      kind: "submitted",
      requestId: req,
      employeeName: "Test Elena",
      leaveTypeName: "Vacation",
      startDate: "2026-11-02",
      endDate: "2026-11-03",
      requestRemoved: false,
      readAt: null,
    });
    const text = JSON.stringify(result);
    expect(text).not.toContain(SECRET_REASON);
    expect(text).not.toContain(SECRET_NOTE);
  });

  it("a notification about a soft-deleted request still lists, flagged removed", async () => {
    const mgr = await person("Test Mgr 2");
    const req = await request({ deleted: true });
    await notes(mgr, req, 1);
    const result = await listNotifications(sql, mgr);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]!.requestRemoved).toBe(true);
  });

  it("AC2: mark-all changes only the session user's rows", async () => {
    const a = await person("Test A2");
    const b = await person("Test B2");
    const req = await request();
    await notes(a, req, 4);
    await notes(b, req, 2);

    expect(await markNotificationsRead(sql, a)).toEqual({ marked: 4, unread: 0 });
    expect(await unreadOf(a)).toBe(0);
    expect(await unreadOf(b)).toBe(2); // untouched
    const list = await listNotifications(sql, a);
    expect(list.unread).toBe(0);
    expect(list.notifications.every((n) => n.readAt !== null)).toBe(true);
    // Marking again is a no-op, not an error.
    expect(await markNotificationsRead(sql, a)).toEqual({ marked: 0, unread: 0 });
  });

  it("AC2: mark-one changes only that row", async () => {
    const a = await person("Test A3");
    const req = await request();
    const ids = await notes(a, req, 3);
    expect(await markNotificationsRead(sql, a, ids[1])).toEqual({ marked: 1, unread: 2 });
    const rows = await sql<{ id: string; read: boolean }[]>`
      select id, read_at is not null as read from public.notifications
      where recipient_id = ${a} order by created_at`;
    expect(rows.map((r) => r.read)).toEqual([false, true, false]);
  });

  it("AC2: a foreign id, an unknown id and an already-read id are the same no-op, and change nothing", async () => {
    const a = await person("Test A4");
    const b = await person("Test B4");
    const req = await request();
    const [aOne, aTwo] = await notes(a, req, 2);
    const [bOne] = await notes(b, req, 1);
    await markNotificationsRead(sql, a, aOne);

    const foreign = await markNotificationsRead(sql, a, bOne);
    const unknown = await markNotificationsRead(sql, a, randomUUID());
    const already = await markNotificationsRead(sql, a, aOne);
    // Same answer shape and values in all three cases: the response does not say whether an id exists.
    expect(foreign).toEqual({ marked: 0, unread: 1 });
    expect(unknown).toEqual(foreign);
    expect(already).toEqual(foreign);
    expect(await unreadOf(b)).toBe(1); // B's row was not marked
    expect(await unreadOf(a)).toBe(1); // aTwo is still unread
    expect(aTwo).toBeDefined();
  });

  it("two simultaneous mark-alls both succeed, and every row is marked exactly once", async () => {
    const a = await person("Test A5");
    const req = await request();
    await notes(a, req, 10);
    const results = await Promise.all([
      markNotificationsRead(sql, a),
      markNotificationsRead(sql, a),
      markNotificationsRead(sql, a),
    ]);
    expect(results.reduce((sum, r) => sum + r.marked, 0)).toBe(10);
    expect(await unreadOf(a)).toBe(0);
  });

  it("the unread count a mark returns equals what the next list reports", async () => {
    const a = await person("Test A6");
    const req = await request();
    const ids = await notes(a, req, 5);
    const marked = await markNotificationsRead(sql, a, ids[4]);
    expect((await listNotifications(sql, a)).unread).toBe(marked.unread);
    expect(marked.unread).toBe(4);
  });
});
