import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ensureAccount,
  parseSeedEmails,
  validateInputs,
  type AdminApi,
} from "./seed-auth-users.lib.ts";

const SEED_SQL = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");
const KEY = "service-role-key-SECRET-123";
const PASSWORD = "demo-password-SECRET-456";
const URL_OK = "https://abcdefghijkl.supabase.co";

/** In-memory stand-in for supabase.auth.admin with pagination, like the real list call. */
function fakeAdmin(initial: { id: string; email: string }[] = []) {
  const users = [...initial];
  const calls = { created: 0, updated: 0, lastCreate: null as unknown, passwords: [] as string[] };
  const api: AdminApi = {
    listUsers: async ({ page, perPage }) => ({
      data: { users: users.slice((page - 1) * perPage, page * perPage) },
      error: null,
    }),
    createUser: async (attrs) => {
      calls.created += 1;
      calls.lastCreate = attrs;
      users.push({ id: `id-${users.length + 1}`, email: attrs.email });
      return { error: null };
    },
    updateUserById: async (_id, attrs) => {
      calls.updated += 1;
      calls.passwords.push(attrs.password);
      return { error: null };
    },
  };
  return { api, users, calls };
}

describe("parseSeedEmails", () => {
  it("AC1: returns exactly the seven seeded emails", () => {
    const emails = parseSeedEmails(SEED_SQL);
    expect(emails).toHaveLength(7);
    expect(emails).toEqual(expect.arrayContaining(["elena.cruz@leavetrack.example"]));
    expect(emails.every((e) => e.endsWith("@leavetrack.example"))).toBe(true);
  });

  it("fails loudly when the users block is missing", () => {
    expect(() => parseSeedEmails("select 1;")).toThrow(/no insert/);
  });
});

describe("ensureAccount", () => {
  it("AC1: creates a missing account with a confirmed email", async () => {
    const { api, calls } = fakeAdmin();
    await expect(ensureAccount(api, "Elena.Cruz@leavetrack.example", PASSWORD)).resolves.toBe(
      "created",
    );
    expect(calls.lastCreate).toEqual({
      email: "elena.cruz@leavetrack.example",
      password: PASSWORD,
      email_confirm: true,
    });
  });

  it("AC2: running twice creates no duplicates and updates the password", async () => {
    const { api, users, calls } = fakeAdmin();
    const emails = parseSeedEmails(SEED_SQL);
    for (const e of emails) await ensureAccount(api, e, PASSWORD);
    expect(users).toHaveLength(7);
    for (const e of emails) {
      await expect(ensureAccount(api, e, "a-new-password-789")).resolves.toBe("updated");
    }
    expect(users).toHaveLength(7);
    expect(calls.created).toBe(7);
    expect(calls.updated).toBe(7);
    expect(calls.passwords.every((p) => p === "a-new-password-789")).toBe(true);
  });

  it("AC2: matches an existing account regardless of email case", async () => {
    const { api, users } = fakeAdmin([{ id: "x", email: "Elena.Cruz@LeaveTrack.example" }]);
    await expect(ensureAccount(api, "elena.cruz@leavetrack.example", PASSWORD)).resolves.toBe(
      "updated",
    );
    expect(users).toHaveLength(1);
  });

  it("AC2: finds an account that is not on the first page of results", async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ id: `u${i}`, email: `u${i}@x.example` }));
    many.push({ id: "late", email: "jun.bautista@leavetrack.example" });
    const { api, users } = fakeAdmin(many);
    await expect(ensureAccount(api, "jun.bautista@leavetrack.example", PASSWORD)).resolves.toBe(
      "updated",
    );
    expect(users).toHaveLength(251);
  });

  it("AC3: failure messages carry the Supabase code, never the password", async () => {
    const { api } = fakeAdmin();
    api.createUser = async () => ({ error: { message: "boom", code: "weak_password" } });
    const err = await ensureAccount(api, "a@leavetrack.example", PASSWORD).catch((e: Error) => e);
    expect((err as Error).message).toContain("weak_password");
    expect((err as Error).message).not.toContain(PASSWORD);
  });
});

describe("validateInputs", () => {
  const good = {
    SUPABASE_URL: URL_OK,
    SUPABASE_SERVICE_ROLE_KEY: KEY,
    DEMO_PASSWORD: PASSWORD,
  };

  it("accepts a hosted project URL and returns the inputs", () => {
    expect(validateInputs(good)).toMatchObject({ url: URL_OK, password: PASSWORD, anonKey: null });
  });

  it("names the missing variables without echoing any value", () => {
    const err = () => validateInputs({ SUPABASE_URL: URL_OK });
    expect(err).toThrow(/SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD/);
  });

  it("AC3: rejects a bad URL or short password without echoing the secrets", () => {
    for (const env of [
      { ...good, SUPABASE_URL: "https://evil.example.com" },
      { ...good, DEMO_PASSWORD: "short" },
    ]) {
      let message = "";
      try {
        validateInputs(env);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).not.toBe("");
      expect(message).not.toContain(KEY);
      expect(message).not.toContain("short");
    }
  });
});
