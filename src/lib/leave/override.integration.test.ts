import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { overrideLeaveRequest } from "@/lib/leave/override";

/**
 * TASK-038 against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at a
 * THROWAWAY database with the migrations applied (leave types come from the migration): the test
 * inserts its own users, balances and requests, which cannot be deleted afterwards. Every
 * assertion is scoped by this file's own random ids. Its rows ARE visible to the HR-wide lists
 * (five rows, everyone), so run it on its own database, never alongside `dashboard-lists`.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const UNPAID = "10000000-0000-4000-8000-000000000003";

const APPROVE = { decision: "approve" } as const;
const REJECT = { decision: "reject", note: "No cover that week" } as const;

describe.skipIf(!url)("HR override (TASK-038, real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 4, onnotice: () => {} });
  const hrA = randomUUID();
  const hrB = randomUUID();
  const marco = randomUUID(); // manager of team one
  const priya = randomUUID(); // manager of another team

  async function user(id: string, name: string, role: string, managerId: string | null) {
    await sql`
      insert into public.users (id, name, email, role, manager_id)
      values (${id}, ${name}, ${`${id}@test.example`}, ${role}::public.user_role, ${managerId})`;
  }

  /** A fresh employee (so balances never interfere) on `managerId`'s team, with balances. */
  async function employee(managerId: string, vac: number | null, sick: number | null = null) {
    const id = randomUUID();
    await user(id, `T-Override ${id.slice(0, 6)}`, "employee", managerId);
    if (vac !== null) {
      await sql`insert into public.leave_balances (user_id, leave_type_id, balance) values (${id}, ${VAC}, ${vac})`;
    }
    if (sick !== null) {
      await sql`insert into public.leave_balances (user_id, leave_type_id, balance) values (${id}, ${SICK}, ${sick})`;
    }
    return id;
  }

  /** A request; 2026-11-02 is a Monday, so Nov 2 to Nov 6 is 5 working days. */
  async function request(
    userId: string,
    typeId = VAC,
    start = "2026-11-02",
    end = "2026-11-06",
    status: "pending" | "approved" = "pending",
    deleted = false,
  ) {
    const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests
        (user_id, leave_type_id, start_date, end_date, status, decided_by, decided_at, is_deleted)
      values (${userId}, ${typeId}, ${start}::date, ${end}::date, ${status}::public.leave_status,
              ${status === "pending" ? null : marco}, ${status === "pending" ? null : sql`now()`},
              ${deleted})
      returning id`;
    return row!.id;
  }

  const balance = async (userId: string, typeId: string) => {
    const [row] = await sql<{ balance: string }[]>`
      select balance::text as balance from public.leave_balances
      where user_id = ${userId} and leave_type_id = ${typeId}`;
    return row?.balance;
  };
  const status = async (requestId: string) => {
    const [row] = await sql<{ status: string; decided_by: string | null }[]>`
      select status::text as status, decided_by from public.leave_requests where id = ${requestId}`;
    return row!;
  };
  const audits = (requestId: string) =>
    sql<
      {
        action: string;
        actor_id: string;
        days_requested: string | null;
        balance_before: string | null;
        shortfall: string | null;
      }[]
    >`
      select action::text as action, actor_id, days_requested::text, balance_before::text,
             shortfall::text
      from public.audit_log where leave_request_id = ${requestId}
      order by occurred_at, id`;

  beforeAll(async () => {
    await user(hrA, "T-Override Hana", "hr_admin", null);
    await user(hrB, "T-Override Sam", "hr_admin", null);
    await user(marco, "T-Override Marco", "manager", hrA);
    await user(priya, "T-Override Priya", "manager", hrA);
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC1: 2 available and 5 requested leaves exactly 0 and records a shortfall of 3", async () => {
    const elena = await employee(marco, 2, 8);
    const id = await request(elena);
    const result = await overrideLeaveRequest(sql, hrA, id, APPROVE);

    expect(result.balance).toEqual({ leaveTypeId: VAC, balance: 0 });
    expect(result.shortfall).toBe("3.00");
    expect(await balance(elena, VAC)).toBe("0.00");
    expect(await status(id)).toEqual({ status: "approved", decided_by: hrA });
    expect(await audits(id)).toEqual([
      {
        action: "override_approved",
        actor_id: hrA,
        days_requested: "5.00",
        balance_before: "2.00",
        shortfall: "3.00",
      },
    ]);
  });

  it("AC1: an HR Admin overrides a request from any team (another manager's report)", async () => {
    const leo = await employee(priya, 4.5);
    const id = await request(leo);
    await overrideLeaveRequest(sql, hrB, id, APPROVE);
    expect(await balance(leo, VAC)).toBe("0.00");
    expect((await audits(id))[0]).toMatchObject({ shortfall: "0.50", actor_id: hrB });
  });

  it("AC2: reject records the note, writes a rejected row and leaves the balance alone", async () => {
    const jun = await employee(marco, 2, 8);
    const id = await request(jun);
    const result = await overrideLeaveRequest(sql, hrA, id, REJECT);

    expect(result.balance).toBeNull();
    expect(await balance(jun, VAC)).toBe("2.00");
    expect(await status(id)).toEqual({ status: "rejected", decided_by: hrA });
    const [row] = await sql<{ decision_note: string }[]>`
      select decision_note from public.leave_requests where id = ${id}`;
    expect(row!.decision_note).toBe("No cover that week");
    expect(await audits(id)).toEqual([
      {
        action: "rejected",
        actor_id: hrA,
        days_requested: null,
        balance_before: null,
        shortfall: null,
      },
    ]);
  });

  it("AC3: a request within balance, an untracked type and a missing balance row are refused", async () => {
    const within = await employee(marco, 5);
    const withinId = await request(within); // 5 days, 5 available
    await expect(overrideLeaveRequest(sql, hrA, withinId, APPROVE)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(overrideLeaveRequest(sql, hrA, withinId, REJECT)).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const unpaid = await employee(marco, 0);
    const unpaidId = await request(unpaid, UNPAID);
    await expect(overrideLeaveRequest(sql, hrA, unpaidId, APPROVE)).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const noRow = await employee(marco, null); // no Vacation balance row at all
    const noRowId = await request(noRow);
    await expect(overrideLeaveRequest(sql, hrA, noRowId, APPROVE)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("no balance record"),
    });

    for (const id of [withinId, unpaidId, noRowId]) {
      expect((await status(id)).status).toBe("pending");
      expect(await audits(id)).toEqual([]);
    }
    expect(await balance(within, VAC)).toBe("5.00");
  });

  it("AC3: a negative balance is refused with a clear message and nothing changes", async () => {
    const neg = await employee(marco, -2);
    const id = await request(neg);
    await expect(overrideLeaveRequest(sql, hrA, id, APPROVE)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("negative"),
    });
    expect(await balance(neg, VAC)).toBe("-2.00");
    expect((await status(id)).status).toBe("pending");
  });

  it("AC4: HR cannot decide a request of its own", async () => {
    await sql`insert into public.leave_balances (user_id, leave_type_id, balance) values (${hrB}, ${VAC}, 1)`;
    const id = await request(hrB);
    for (const input of [APPROVE, REJECT]) {
      await expect(overrideLeaveRequest(sql, hrB, id, input)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    expect((await status(id)).status).toBe("pending");
    expect(await balance(hrB, VAC)).toBe("1.00");
    expect(await audits(id)).toEqual([]);
    // Another HR Admin can.
    await overrideLeaveRequest(sql, hrA, id, APPROVE);
    expect((await status(id)).status).toBe("approved");
  });

  it("AC5: overriding Vacation never changes the Sick balance", async () => {
    const mia = await employee(marco, 1, 8);
    const id = await request(mia);
    await overrideLeaveRequest(sql, hrA, id, APPROVE);
    expect(await balance(mia, VAC)).toBe("0.00");
    expect(await balance(mia, SICK)).toBe("8.00");
  });

  it("AC5: a Sick override changes only Sick", async () => {
    const ana = await employee(marco, 9, 1);
    const id = await request(ana, SICK, "2026-11-02", "2026-11-03");
    await overrideLeaveRequest(sql, hrA, id, APPROVE);
    expect(await balance(ana, SICK)).toBe("0.00");
    expect(await balance(ana, VAC)).toBe("9.00");
  });

  it("AC6: a second decision changes nothing, and a deleted or already approved request is refused", async () => {
    const eli = await employee(marco, 1);
    const id = await request(eli);
    await overrideLeaveRequest(sql, hrA, id, APPROVE);
    await expect(overrideLeaveRequest(sql, hrB, id, APPROVE)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(overrideLeaveRequest(sql, hrB, id, REJECT)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await balance(eli, VAC)).toBe("0.00");
    expect(await audits(id)).toHaveLength(1);

    const gone = await employee(marco, 1);
    const goneId = await request(gone, VAC, "2026-11-02", "2026-11-06", "pending", true);
    await expect(overrideLeaveRequest(sql, hrA, goneId, APPROVE)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await balance(gone, VAC)).toBe("1.00");

    const done = await employee(marco, 1);
    const doneId = await request(done, VAC, "2026-11-02", "2026-11-06", "approved");
    await expect(overrideLeaveRequest(sql, hrA, doneId, APPROVE)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await balance(done, VAC)).toBe("1.00");
  });

  it("AC6: two simultaneous overrides take turns; exactly one wins and one audit row exists", async () => {
    const zed = await employee(marco, 2);
    const id = await request(zed);
    const results = await Promise.allSettled([
      overrideLeaveRequest(sql, hrA, id, APPROVE),
      overrideLeaveRequest(sql, hrB, id, APPROVE),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(lost.reason).toMatchObject({ code: "CONFLICT" });
    expect(await balance(zed, VAC)).toBe("0.00");
    expect(await audits(id)).toHaveLength(1);
  });
});
