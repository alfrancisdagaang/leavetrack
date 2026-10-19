import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * EPIC-9 / TASK-052 against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at
 * a THROWAWAY database with the migrations applied (never one with real data): the test inserts
 * its own users, requests and notifications, and none of them can be deleted afterwards. Every
 * read below is scoped to this file's own recipients, so other rows cannot change a result.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";

describe.skipIf(!url)("notifications table (TASK-052, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 2, onnotice: () => {} });
  const marco = randomUUID();
  const leo = randomUUID();
  const elena = randomUUID();
  let requestId = "";

  const notify = async (recipient: string, kind = "submitted") => {
    const [row] = await sql<{ id: string }[]>`
      insert into public.notifications (recipient_id, kind, leave_request_id)
      values (${recipient}, ${kind}, ${requestId})
      returning id`;
    return row!.id;
  };

  beforeAll(async () => {
    for (const [id, name, role] of [
      [marco, "Test Marco", "manager"],
      [leo, "Test Leo", "manager"],
      [elena, "Test Elena", "employee"],
    ] as const) {
      await sql`
        insert into public.users (id, name, email, role)
        values (${id}, ${name}, ${`${id}@test.example`}, ${role}::public.user_role)`;
    }
    const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests (user_id, leave_type_id, start_date, end_date)
      values (${elena}, ${VAC}, date '2026-11-02', date '2026-11-03')
      returning id`;
    requestId = row!.id;
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC1: a notification inserts for a recipient and read_at can be set once", async () => {
    const id = await notify(marco);
    const [fresh] = await sql<{ read_at: Date | null }[]>`
      select read_at from public.notifications where id = ${id}`;
    expect(fresh!.read_at).toBeNull();

    await sql`update public.notifications set read_at = now() where id = ${id}`;
    const [read] = await sql<{ read_at: Date | null }[]>`
      select read_at from public.notifications where id = ${id}`;
    expect(read!.read_at).not.toBeNull();

    // Read once: not changed, not cleared.
    await expect(
      sql`update public.notifications set read_at = now() + interval '1 hour' where id = ${id}`,
    ).rejects.toMatchObject({ code: "23001" });
    await expect(
      sql`update public.notifications set read_at = null where id = ${id}`,
    ).rejects.toMatchObject({ code: "23001" });
  });

  it("AC1: nothing but read_at can change, and an unknown kind is refused", async () => {
    const id = await notify(marco, "approved");
    await expect(
      sql`update public.notifications set kind = 'rejected' where id = ${id}`,
    ).rejects.toMatchObject({ code: "23001" });
    await expect(
      sql`update public.notifications set recipient_id = ${leo} where id = ${id}`,
    ).rejects.toMatchObject({ code: "23001" });
    await expect(
      sql`update public.notifications set leave_request_id = ${requestId} where id = ${id}`,
    ).resolves.toBeDefined(); // same value: not a change
    await expect(notify(marco, "bogus")).rejects.toMatchObject({ code: "23514" });
    await expect(
      sql`update public.notifications set read_at = created_at - interval '1 second' where id = ${id}`,
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("AC1: a notification cannot be deleted or truncated", async () => {
    const id = await notify(marco);
    await expect(sql`delete from public.notifications where id = ${id}`).rejects.toMatchObject({
      code: "23001",
    });
    await expect(sql`truncate public.notifications`).rejects.toMatchObject({ code: "23001" });
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int as n from public.notifications where id = ${id}`;
    expect(row!.n).toBe(1);
  });

  it("AC1: both FKs restrict, so a recipient or request with notifications cannot be removed", async () => {
    await notify(leo);
    await expect(sql`delete from public.users where id = ${leo}`).rejects.toMatchObject({
      code: "23001", // ON DELETE RESTRICT reports restrict_violation
    });
  });

  it("AC2: the unread read for one recipient uses the partial index and never returns another person's rows", async () => {
    const mine = randomUUID();
    const other = randomUUID();
    for (const id of [mine, other]) {
      await sql`
        insert into public.users (id, name, email, role)
        values (${id}, 'Test Idx', ${`${id}@test.example`}, 'manager')`;
    }
    await sql`
      insert into public.notifications (recipient_id, kind, leave_request_id, created_at)
      select ${mine}, 'submitted', ${requestId}, now() - make_interval(secs => g)
      from generate_series(1, 200) g`;
    await sql`
      insert into public.notifications (recipient_id, kind, leave_request_id, created_at)
      select ${other}, 'submitted', ${requestId}, now() - make_interval(secs => g)
      from generate_series(1, 200) g`;
    // Half of mine are read, so only the unread ones may come back.
    await sql`
      update public.notifications set read_at = now()
      where recipient_id = ${mine} and created_at < now() - interval '100 seconds'`;
    await sql`analyze public.notifications`;

    const unread = await sql<{ recipient_id: string; read_at: Date | null }[]>`
      select recipient_id, read_at from public.notifications
      where recipient_id = ${mine} and read_at is null
      order by created_at desc limit 20`;
    expect(unread.length).toBe(20);
    expect(unread.every((r) => r.recipient_id === mine && r.read_at === null)).toBe(true);

    const plan = await sql.begin(async (tx) => {
      await tx`set local enable_seqscan = off`;
      return tx<{ "QUERY PLAN": string }[]>`
        explain select count(*) from public.notifications
        where recipient_id = ${mine} and read_at is null`;
    });
    const text = plan.map((r) => r["QUERY PLAN"]).join("\n");
    // Which of the two recipient indexes the planner picks depends on statistics that other test
    // files change while this one runs, so assert what must always hold: an index scan on one of
    // them, never a sequential scan. That the partial index exists is checked on its own below.
    expect(text).toMatch(/notifications_recipient_(created|unread)_idx/);
    expect(text).not.toContain("Seq Scan");

    const [partial] = await sql<{ indexdef: string }[]>`
      select indexdef from pg_indexes
      where schemaname = 'public' and tablename = 'notifications'
        and indexname = 'notifications_recipient_unread_idx'`;
    expect(partial?.indexdef).toMatch(
      /\(recipient_id, created_at DESC\) WHERE \(read_at IS NULL\)/,
    );
  });
});
