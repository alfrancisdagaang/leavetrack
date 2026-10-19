import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { yearBounds } from "@/lib/leave/breakdown";
import { getAuditPage } from "@/lib/leave/audit-list";
import { overrideLeaveRequest } from "@/lib/leave/override";
import { getOverrideQueue } from "@/lib/leave/override-queue";
import { getBalancePage, getMySummary } from "@/lib/leave/service";
import { getRecentlyDecided, getTeamQueue } from "@/lib/leave/team";
import { getTeamMemberPage } from "@/lib/leave/team-member";

/**
 * TASK-040 against a real database: the over-balance states for managers and employees, and the
 * "approved by HR override" flag in every list that shows it. Skipped unless TEST_DATABASE_URL is
 * set. Point it at a THROWAWAY database with the migrations applied and NO seed data: the
 * recently-decided and HR lists are capped, so other people's rows could crowd out the ones asserted
 * here. The test inserts its own users, balances and requests, which cannot be deleted afterwards.
 * Run it on its own database, never alongside `dashboard-lists`.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const UNPAID = "10000000-0000-4000-8000-000000000003";
const PREFIX = "T-States";

describe.skipIf(!url)("over-balance states and override flag (TASK-040, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 3, onnotice: () => {} });
  const hr = randomUUID();
  const marco = randomUUID(); // manager of team one
  const priya = randomUUID(); // another team
  const e: Record<string, string> = {};
  const requestOf: Record<string, string> = {};

  async function user(id: string, name: string, role: string, managerId: string | null) {
    await sql`
      insert into public.users (id, name, email, role, manager_id)
      values (${id}, ${name}, ${`${id}@test.example`}, ${role}::public.user_role, ${managerId})`;
  }

  /** One employee on `managerId`'s team, optionally with a Vacation balance. */
  async function employee(key: string, managerId: string, vac: number | null) {
    e[key] = randomUUID();
    await user(e[key], `${PREFIX} ${key}`, "employee", managerId);
    if (vac !== null) {
      await sql`insert into public.leave_balances (user_id, leave_type_id, balance) values (${e[key]}, ${VAC}, ${vac})`;
    }
  }

  /** A request; 2026-11-02 is a Monday, so Nov 2 to Nov 6 is 5 working days. */
  async function leave(
    key: string,
    typeId: string,
    start: string,
    end: string,
    status: "pending" | "approved" = "pending",
  ) {
    const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests
        (user_id, leave_type_id, start_date, end_date, status, decided_by, decided_at)
      values (${e[key]!}, ${typeId}, ${start}::date, ${end}::date, ${status}::public.leave_status,
              ${status === "pending" ? null : marco}, ${status === "pending" ? null : sql`now()`})
      returning id`;
    requestOf[key] = row!.id;
    await sql`insert into public.audit_log (leave_request_id, actor_id, action) values (${row!.id}, ${e[key]!}, 'submitted')`;
    if (status === "approved") {
      await sql`insert into public.audit_log (leave_request_id, actor_id, action) values (${row!.id}, ${marco}, 'approved')`;
    }
  }

  const auditQuery = {
    q: PREFIX,
    leaveTypeId: undefined,
    status: undefined,
    decidedBy: undefined,
    from: undefined,
    to: undefined,
    page: 1,
  };
  const member = (key: string) =>
    getTeamMemberPage(sql, marco, e[key]!, {
      leaveTypeId: undefined,
      status: undefined,
      year: 2026,
      page: 1,
    });

  beforeAll(async () => {
    await user(hr, `${PREFIX} Hana`, "hr_admin", null);
    await user(marco, `${PREFIX} Marco`, "manager", hr);
    await user(priya, `${PREFIX} Priya`, "manager", hr);
    await employee("over", marco, 2);
    await employee("none", marco, null);
    await employee("negative", marco, -2);
    await employee("unpaid", marco, 0);
    await employee("ok", marco, 10);
    await employee("ovr", marco, 2);
    await employee("plain", marco, 10);
    await employee("leo", priya, 1);

    await leave("over", VAC, "2026-11-02", "2026-11-06"); // 5 days against 2
    await leave("none", VAC, "2026-11-09", "2026-11-11"); // 3 days, no balance row
    await leave("negative", VAC, "2026-11-09", "2026-11-11");
    await leave("unpaid", UNPAID, "2026-11-02", "2026-11-06");
    await leave("ok", VAC, "2026-11-09", "2026-11-11"); // 3 days against 10
    await leave("leo", VAC, "2026-11-02", "2026-11-06"); // another team
    await leave("ovr", VAC, "2026-11-02", "2026-11-06");
    await overrideLeaveRequest(sql, hr, requestOf.ovr!, { decision: "approve" });
    await leave("plain", VAC, "2026-11-09", "2026-11-10", "approved");
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC1: Marco's queue marks each pending request over, no balance record, negative or ok, and never shows Leo", async () => {
    const queue = (await getTeamQueue(sql, marco)).filter((r) =>
      r.employee_name.startsWith(PREFIX),
    );
    const kinds = Object.fromEntries(
      queue.map((r) => [r.employee_name.slice(PREFIX.length + 1), r.balanceCheck]),
    );
    expect(kinds).toEqual({
      over: { kind: "over", balance: 2, shortfall: 3 },
      none: { kind: "no_balance_record" },
      negative: { kind: "negative", balance: -2 },
      unpaid: { kind: "ok" },
      ok: { kind: "ok" },
    });
    expect(queue.some((r) => r.employee_name.endsWith("leo"))).toBe(false);
  });

  it("AC1: the team member page says the same for the same requests", async () => {
    expect((await member("over"))?.requests[0]?.balanceCheck).toEqual({
      kind: "over",
      balance: 2,
      shortfall: 3,
    });
    expect((await member("none"))?.requests[0]?.balanceCheck).toEqual({
      kind: "no_balance_record",
    });
    expect((await member("negative"))?.requests[0]?.balanceCheck).toEqual({
      kind: "negative",
      balance: -2,
    });
    expect((await member("ok"))?.requests[0]?.balanceCheck).toEqual({ kind: "ok" });
    expect((await member("unpaid"))?.requests[0]?.balanceCheck).toEqual({ kind: "ok" });
    // Another team's member is still not found for Marco.
    expect(await member("leo")).toBeNull();
  });

  it("the shared rule agrees with the HR queue: the same requests are 'over' and listed for HR", async () => {
    const hrQueue = (await getOverrideQueue(sql, hr)).rows.filter((r) =>
      r.employee_name.startsWith(PREFIX),
    );
    const listedForHr = new Set(hrQueue.map((r) => r.employee_name.slice(PREFIX.length + 1)));
    // Marco's team: exactly the 'over' one; plus Leo, who is on another team and only HR sees.
    expect(listedForHr).toEqual(new Set(["over", "leo"]));
  });

  it("AC3: an approval HR made as an override is flagged on the team member page, an ordinary one is not", async () => {
    expect((await member("ovr"))?.requests[0]).toMatchObject({
      status: "approved",
      overridden: true,
      balanceCheck: { kind: "ok" },
    });
    expect((await member("plain"))?.requests[0]).toMatchObject({
      status: "approved",
      overridden: false,
    });
    expect((await member("over"))?.requests[0]?.overridden).toBe(false);
  });

  it("AC3: Marco's Recently decided flags the override and not the ordinary approval", async () => {
    const decided = (await getRecentlyDecided(sql, marco)).filter((r) =>
      r.employee_name.startsWith(PREFIX),
    );
    const flag = Object.fromEntries(
      decided.map((r) => [r.employee_name.slice(PREFIX.length + 1), r.overridden]),
    );
    expect(flag).toEqual({ ovr: true, plain: false });
  });

  it("AC3: the audit list flags the override, and the buckets still add up to the total", async () => {
    const result = await getAuditPage(sql, auditQuery);
    const flag = Object.fromEntries(
      result.rows.map((r) => [r.employeeName.slice(PREFIX.length + 1), r.overridden]),
    );
    expect(flag.ovr).toBe(true);
    expect(Object.entries(flag).filter(([, overridden]) => overridden)).toEqual([["ovr", true]]);
    const { total, approved, rejected, pending, deleted } = result.counts;
    expect(approved + rejected + pending + deleted).toBe(total);
    expect(approved).toBe(2); // the override and the ordinary approval both count as approved
  });

  it("AC2: the employee's own list flags the override and, in the same read, carries what the note needs", async () => {
    const mine = await getMySummary(sql, e.ovr!);
    expect(mine.requests[0]).toMatchObject({ status: "approved", overridden: true });
    expect((await getMySummary(sql, e.plain!)).requests[0]?.overridden).toBe(false);

    const page = await getBalancePage(sql, e.over!, yearBounds("2026-10-19"));
    expect(page.requests[0]).toMatchObject({ status: "pending", overridden: false });
    const vac = page.balances.find((b) => b.leaveTypeId === VAC);
    expect(vac).toMatchObject({ tracksBalance: true, confirmed: 2 });
  });
});
