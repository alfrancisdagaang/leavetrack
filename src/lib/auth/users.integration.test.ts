import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findUserByEmail } from "@/lib/auth/users";

/**
 * TASK-020 AC4 against a real database. Skipped unless TEST_DATABASE_URL is set. Point it at a
 * THROWAWAY database with the migrations applied: the test inserts its own users.
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("findUserByEmail (real database)", () => {
  const sql = postgres(url ?? "", { prepare: false, max: 2, onnotice: () => {} });
  const manager = randomUUID();
  const employee = randomUUID();
  const other = randomUUID();
  const tag = randomUUID();
  const employeeEmail = `Emp-${tag}@Test.Example`;

  beforeAll(async () => {
    await sql`
      insert into public.users (id, name, email, role, manager_id) values
        (${manager}, 'Test Manager', ${`mgr-${tag}@test.example`}, 'manager', null),
        (${employee}, 'Test Employee', ${employeeEmail}, 'employee', ${manager}),
        (${other}, 'Other Team', ${`other-${tag}@test.example`}, 'employee', null)`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it("AC4: matches regardless of case and returns that row's id, role and manager", async () => {
    for (const email of [employeeEmail, employeeEmail.toLowerCase(), employeeEmail.toUpperCase()]) {
      const user = await findUserByEmail(sql, email);
      expect(user).toMatchObject({ id: employee, role: "employee", manager_id: manager });
    }
  });

  it("AC2: an email with no users row finds nothing", async () => {
    expect(await findUserByEmail(sql, `nobody-${tag}@test.example`)).toBeNull();
  });

  it("a user on another team resolves only to themselves", async () => {
    const user = await findUserByEmail(sql, `other-${tag}@test.example`);
    expect(user?.id).toBe(other);
    expect(user?.manager_id).toBeNull();
  });

  it("treats SQL metacharacters in the email as data", async () => {
    expect(await findUserByEmail(sql, "' or true --")).toBeNull();
  });
});
