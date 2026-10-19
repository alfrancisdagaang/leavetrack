import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, LEAVE_STATUSES } from "@/lib/db/types";

/**
 * EPIC-6 / TASK-037 against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at
 * a THROWAWAY database with the migrations applied (never one with real data): the test inserts
 * its own users and requests, and leave requests and audit rows cannot be deleted afterwards.
 */
const url = process.env.TEST_DATABASE_URL;

const VAC = "10000000-0000-4000-8000-000000000001";

describe.skipIf(!url)(
  "override_approved audit action and shortfall record (TASK-037, real database)",
  () => {
    const sql = postgres(url ?? "", { prepare: false, max: 2, onnotice: () => {} });
    const hr = randomUUID();
    const employee = randomUUID();

    const newRequest = async () => {
      const [row] = await sql<{ id: string }[]>`
      insert into public.leave_requests (user_id, leave_type_id, start_date, end_date)
      values (${employee}, ${VAC}, date '2026-11-02', date '2026-11-13')
      returning id`;
      return row!.id;
    };

    const audit = (id: string, action: string, days: number, before: number, shortfall: number) =>
      sql`
      insert into public.audit_log
        (leave_request_id, actor_id, action, days_requested, balance_before, shortfall)
      values (${id}, ${hr}, ${action}, ${days}, ${before}, ${shortfall})`;

    beforeAll(async () => {
      await sql`
      insert into public.users (id, name, email, role, manager_id) values
        (${hr}, 'Test HR', ${`hr-${hr}@test.example`}, 'hr_admin', null)`;
      await sql`
      insert into public.users (id, name, email, role, manager_id) values
        (${employee}, 'Test Employee', ${`emp-${employee}@test.example`}, 'employee', null)`;
    });

    afterAll(async () => {
      await sql.end();
    });

    it("AC1: override_approved is accepted; pending_hr and escalated do not exist", async () => {
      const id = await newRequest();
      await audit(id, "override_approved", 10, 4, 6);
      const [row] = await sql<{ action: string }[]>`
      select action::text as action from public.audit_log where leave_request_id = ${id}`;
      expect(row).toEqual({ action: "override_approved" });

      await expect(
        sql`update public.leave_requests set status = 'pending_hr' where id = ${id}`,
      ).rejects.toMatchObject({ code: "22P02" });
      await expect(
        sql`insert into public.audit_log (leave_request_id, actor_id, action)
          values (${id}, ${hr}, 'escalated')`,
      ).rejects.toMatchObject({ code: "22P02" });
    });

    it("AC2: the shortfall is stored on override_approved rows only, consistent, and append-only", async () => {
      const id = await newRequest();
      await audit(id, "override_approved", 10, 4, 6);
      const [row] = await sql<
        { days_requested: string; balance_before: string; shortfall: string }[]
      >`
      select days_requested::text, balance_before::text, shortfall::text
      from public.audit_log where leave_request_id = ${id}`;
      expect(row).toEqual({ days_requested: "10.00", balance_before: "4.00", shortfall: "6.00" });

      // Present exactly on override_approved rows, and consistent.
      await expect(
        sql`insert into public.audit_log (leave_request_id, actor_id, action)
          values (${id}, ${hr}, 'override_approved')`,
      ).rejects.toMatchObject({ code: "23514" });
      await expect(audit(id, "override_approved", 10, 4, 5)).rejects.toMatchObject({
        code: "23514",
      });
      await expect(audit(id, "override_approved", 3, -1, 4)).rejects.toMatchObject({
        code: "23514",
      });
      await expect(audit(id, "override_approved", 4, 4, 0)).rejects.toMatchObject({
        code: "23514",
      });
      await expect(audit(id, "submitted", 10, 4, 6)).rejects.toMatchObject({ code: "23514" });

      // Append-only still holds for the new columns.
      await expect(
        sql`update public.audit_log set shortfall = 1 where leave_request_id = ${id}`,
      ).rejects.toMatchObject({ code: "23001" });
      await expect(
        sql`delete from public.audit_log where leave_request_id = ${id}`,
      ).rejects.toMatchObject({ code: "23001" });
    });

    it("AC3: types.ts lists exactly the values the database enums hold", async () => {
      const [row] = await sql<{ statuses: string[]; actions: string[] }[]>`
      select enum_range(null::public.leave_status)::text[] as statuses,
             enum_range(null::public.audit_action)::text[] as actions`;
      expect([...row!.statuses].sort()).toEqual([...LEAVE_STATUSES].sort());
      expect([...row!.actions].sort()).toEqual([...AUDIT_ACTIONS].sort());
    });
  },
);
