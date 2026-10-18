import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAuditFilterChoices, getAuditPage } from "@/lib/leave/audit-list";
import { AUDIT_PAGE_SIZE, type AuditListQuery } from "@/lib/leave/schemas";

/**
 * US-14 against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at a THROWAWAY
 * database with the migrations applied: the test inserts its own users and requests, which cannot be
 * deleted afterwards. Run this file alone on a fresh database. Every search below is scoped to this
 * file's own "T-Audit" names, so other rows in the database cannot change a result.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const SECRET = "secret medical detail";

describe.skipIf(!url)("audit list (US-14, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 1, onnotice: () => {} });
  const hr = randomUUID();
  const mgr = randomUUID();
  const ana = randomUUID();
  const ben = randomUUID();
  const dee = randomUUID(); // a name with a % in it
  const pager = randomUUID();
  const id: Record<string, string> = {};

  const q = (over: Partial<AuditListQuery> = {}): AuditListQuery => ({
    q: "T-Audit",
    leaveTypeId: undefined,
    status: undefined,
    decidedBy: undefined,
    from: undefined,
    to: undefined,
    page: 1,
    ...over,
  });
  const ids = async (over: Partial<AuditListQuery> = {}) =>
    (await getAuditPage(sql, q(over))).rows.map((r) => r.id).sort();
  const want = (...keys: string[]) => keys.map((k) => id[k]!).sort();

  async function user(uid: string, name: string, role: string) {
    await sql`
      insert into public.users (id, name, email, role)
      values (${uid}, ${name}, ${`${uid}@test.example`}, ${role}::public.user_role)`;
  }

  async function request(
    key: string,
    userId: string,
    typeId: string,
    start: string,
    status: "pending" | "approved" | "rejected",
    by: string | null,
    created: string,
    events: [string, string, string][], // [action, actor, at]
    deleted = false,
  ) {
    const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests
        (user_id, leave_type_id, start_date, end_date, reason, status, decided_by, decided_at,
         decision_note, is_deleted, created_at)
      values (${userId}, ${typeId}, ${start}::date, ${start}::date, ${SECRET},
              ${status}::public.leave_status, ${by}, ${by ? sql`now()` : null},
              ${status === "rejected" ? "Not this week" : null}, ${deleted}, ${created}::timestamptz)
      returning id`;
    id[key] = row!.id;
    for (const [action, actor, at] of events) {
      await sql`
        insert into public.audit_log (leave_request_id, actor_id, action, occurred_at)
        values (${row!.id}, ${actor}, ${action}::public.audit_action, ${at}::timestamptz)`;
    }
  }

  beforeAll(async () => {
    await user(hr, "T-Audit Hana", "hr_admin");
    await user(mgr, "T-Audit Marco", "manager");
    await user(ana, "T-Audit Ana", "employee");
    await user(ben, "T-Audit Ben", "employee");
    await user(dee, "T-Audit Pct%Dee", "employee");
    await user(pager, "T-Pager Pat", "employee");

    // r1: approved by Marco; the approval is late on 1 Oct (tests the inclusive end of a day).
    await request("r1", ana, VAC, "2026-11-02", "approved", mgr, "2026-09-20T09:00:00Z", [
      ["submitted", ana, "2026-09-20T09:00:00Z"],
      ["approved", mgr, "2026-10-01T23:30:00Z"],
    ]);
    // r2: still pending.
    await request("r2", ana, SICK, "2026-11-09", "pending", null, "2026-10-05T09:00:00Z", [
      ["submitted", ana, "2026-10-05T09:00:00Z"],
    ]);
    // r3: rejected by Hana, long ago.
    await request("r3", ben, VAC, "2025-02-03", "rejected", hr, "2025-01-10T09:00:00Z", [
      ["submitted", ben, "2025-01-10T09:00:00Z"],
      ["rejected", hr, "2025-01-12T10:00:00Z"],
    ]);
    // r4: approved by Marco and later soft-deleted: it must count as REMOVED only.
    await request(
      "r4",
      ben,
      VAC,
      "2026-03-02",
      "approved",
      mgr,
      "2026-02-01T09:00:00Z",
      [
        ["submitted", ben, "2026-02-01T09:00:00Z"],
        ["approved", mgr, "2026-02-02T09:00:00Z"],
        ["soft_deleted", mgr, "2026-02-10T09:00:00Z"],
      ],
      true,
    );
    // r5: pending, for the person whose name contains a percent sign.
    await request("r5", dee, SICK, "2026-11-16", "pending", null, "2026-10-06T09:00:00Z", [
      ["submitted", dee, "2026-10-06T09:00:00Z"],
    ]);
    // 30 requests for the pager person, on distinct days, oldest first.
    for (let i = 0; i < 30; i++) {
      const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      await request(`p${i}`, pager, VAC, day, "pending", null, `${day}T08:00:00Z`, [
        ["submitted", pager, `${day}T08:00:00Z`],
      ]);
    }
  });

  afterAll(async () => {
    await sql.end();
  });

  it("with no filter beyond the name prefix: every request, and the buckets add up to the total", async () => {
    const page = await getAuditPage(sql, q());
    expect(page.counts).toEqual({ total: 5, approved: 1, rejected: 1, pending: 2, deleted: 1 });
    const { total, approved, rejected, pending, deleted } = page.counts;
    expect(approved + rejected + pending + deleted).toBe(total);
    expect(page.rows.map((r) => r.id).sort()).toEqual(want("r1", "r2", "r3", "r4", "r5"));
  });

  it("a soft-deleted request that was approved is counted and listed as removed, not as approved", async () => {
    expect(await ids({ status: "approved" })).toEqual(want("r1"));
    expect(await ids({ status: "deleted" })).toEqual(want("r4"));
    const row = (await getAuditPage(sql, q({ status: "deleted" }))).rows[0]!;
    expect(row).toMatchObject({ isDeleted: true, status: "approved" });
  });

  it("filters by each status", async () => {
    expect(await ids({ status: "pending" })).toEqual(want("r2", "r5"));
    expect(await ids({ status: "rejected" })).toEqual(want("r3"));
  });

  it("filters by leave type", async () => {
    expect(await ids({ leaveTypeId: SICK })).toEqual(want("r2", "r5"));
    expect(await ids({ leaveTypeId: VAC })).toEqual(want("r1", "r3", "r4"));
  });

  it("filters by who decided (a pending request has no decider)", async () => {
    expect(await ids({ decidedBy: mgr })).toEqual(want("r1", "r4"));
    expect(await ids({ decidedBy: hr })).toEqual(want("r3"));
  });

  it("matches a date range on ANY audit event of the request, in UTC, inclusive of the last day", async () => {
    // r1's approval happened at 23:30 UTC on 1 Oct: the day 2026-10-01 contains it.
    expect(await ids({ from: "2026-10-01", to: "2026-10-01" })).toEqual(want("r1"));
    expect(await ids({ from: "2026-10-02", to: "2026-10-04" })).toEqual([]);
    expect(await ids({ from: "2025-01-12", to: "2025-01-12" })).toEqual(want("r3"));
    // Only the start: everything with an event on or after it.
    expect(await ids({ from: "2026-10-05" })).toEqual(want("r2", "r5"));
    // Only the end: everything with an event on or before it.
    expect(await ids({ to: "2025-12-31" })).toEqual(want("r3"));
  });

  it("combines filters (all must hold)", async () => {
    expect(await ids({ leaveTypeId: VAC, decidedBy: mgr, status: "approved" })).toEqual(want("r1"));
    expect(await ids({ leaveTypeId: SICK, decidedBy: mgr })).toEqual([]);
  });

  it("searches the employee name, ignoring case, as part of the name", async () => {
    expect(await ids({ q: "t-audit ana" })).toEqual(want("r1", "r2"));
    expect(await ids({ q: "BEN" })).toEqual(want("r3", "r4"));
  });

  it("matches a typed % or _ literally, so it cannot be used as a wildcard", async () => {
    expect(await ids({ q: "Pct%Dee" })).toEqual(want("r5"));
    expect(await ids({ q: "%" })).toEqual(want("r5"));
    expect(await ids({ q: "T-Audit _na" })).toEqual([]); // `_` would match "A" if it were a wildcard
  });

  it("pages 25 at a time with the total, the last page holds the rest, and past the end shows the last", async () => {
    const pat = (page: number) => getAuditPage(sql, q({ q: "T-Pager", page }));
    const first = await pat(1);
    expect(first.counts.total).toBe(30);
    expect(first.rows).toHaveLength(AUDIT_PAGE_SIZE);
    expect(first.page).toBe(1);
    const second = await pat(2);
    expect(second.rows).toHaveLength(5);
    const past = await pat(9);
    expect(past.page).toBe(2);
    expect(past.rows.map((r) => r.id)).toEqual(second.rows.map((r) => r.id));
    // Newest first, with no row on two pages.
    const all = [...first.rows, ...second.rows].map((r) => r.id);
    expect(new Set(all).size).toBe(30);
    expect(first.rows[0]!.startDate).toBe("2026-01-30");
  });

  it("never returns the employee's free-text reason or the decision note", async () => {
    const page = await getAuditPage(sql, q());
    expect(JSON.stringify(page)).not.toContain(SECRET);
    expect(JSON.stringify(page)).not.toContain("Not this week");
  });

  it("offers every leave type and the people who have decided a request", async () => {
    const choices = await getAuditFilterChoices(sql);
    expect(choices.leaveTypes.map((t) => t.id)).toEqual(expect.arrayContaining([VAC, SICK]));
    const names = choices.deciders.map((d) => d.name);
    expect(names).toEqual(expect.arrayContaining(["T-Audit Hana", "T-Audit Marco"]));
    expect(names).not.toContain("T-Audit Ana"); // decided nothing
    // Everyone is offered as a name suggestion (decided or not), in name order.
    expect(choices.employeeNames).toEqual(expect.arrayContaining(["T-Audit Ana", "T-Audit Ben"]));
    expect([...choices.employeeNames].sort()).toEqual(choices.employeeNames);
  });
});
