import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOCK_USERS } from "@/lib/mock/users";

/**
 * The demo seed and the mock users describe the same people, and manager_id is an EMPLOYEE's approver
 * (BRD BR-02, PRD US-03/US-04, ARCH): only employees have a manager. A manager or HR admin has none, so
 * nobody sits above them in the organization chart. This reads `supabase/seed.sql` so the two cannot drift
 * apart, and so the old reporting lines (Sam above Hana above Marco and Priya) cannot come back unseen.
 */
const SEED = readFileSync(new URL("../../../supabase/seed.sql", import.meta.url), "utf8");

type SeedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  manager_id: string | null;
};

const block = /insert\s+into\s+public\.users\b[\s\S]*?\bon\s+conflict\b/i.exec(SEED)?.[0] ?? "";
const ROW =
  /\('([0-9a-f-]{36})',\s*'([^']+)',\s*'([^']+)',\s*'(\w+)',\s*(null|'[0-9a-f-]{36}')\)/gi;
const rows: SeedUser[] = [...block.matchAll(ROW)].map((m) => ({
  id: m[1]!,
  name: m[2]!,
  email: m[3]!,
  role: m[4]!,
  manager_id: m[5] === "null" ? null : m[5]!.slice(1, -1),
}));
const byId = new Map(rows.map((r) => [r.id, r]));

describe("seed.sql reporting lines", () => {
  it("parses the seven demo users", () => {
    expect(rows).toHaveLength(7);
  });

  it("gives no manager to a manager or an HR admin", () => {
    const withManager = rows.filter((r) => r.role !== "employee" && r.manager_id !== null);
    expect(withManager.map((r) => r.name)).toEqual([]);
  });

  it("gives every employee a manager, and that manager is a manager", () => {
    for (const r of rows.filter((u) => u.role === "employee")) {
      expect(r.manager_id, `${r.name} has a manager`).not.toBeNull();
      expect(byId.get(r.manager_id!)?.role, `${r.name}'s manager is a manager`).toBe("manager");
    }
  });

  it("keeps the two teams: Marco has Elena and Jun, Priya has Leo", () => {
    const team = (managerName: string) =>
      rows
        .filter((r) => byId.get(r.manager_id ?? "")?.name === managerName)
        .map((r) => r.name)
        .sort();
    expect(team("Marco Santos")).toEqual(["Elena Cruz", "Jun Bautista"]);
    expect(team("Priya Nair")).toEqual(["Leo Garcia"]);
  });

  it("never sets a manager on a manager or an HR admin in a later statement (the old 'point Hana at Sam' update would undo this on every run)", () => {
    const updates = [...SEED.matchAll(/update\s+public\.users\b[\s\S]*?;/gi)].map((m) => m[0]);
    expect(updates.length).toBeGreaterThan(0);
    for (const u of updates) expect(u, u).not.toMatch(/manager_id\s*=\s*'/i);
  });

  it("clears the old lines of exactly Hana, Marco and Priya on a database seeded earlier, and nobody else", () => {
    const clearing = [...SEED.matchAll(/update\s+public\.users\b[\s\S]*?;/gi)]
      .map((m) => m[0])
      .find((u) => /set\s+manager_id\s*=\s*null/i.test(u));
    expect(clearing).toBeTruthy();
    const ids = [...clearing!.matchAll(/'([0-9a-f-]{36})'/gi)].map((m) => m[1]!).sort();
    const expected = rows
      .filter((r) => ["Hana Reyes", "Marco Santos", "Priya Nair"].includes(r.name))
      .map((r) => r.id)
      .sort();
    expect(ids).toEqual(expected);
    expect(clearing).toMatch(/manager_id is not null/i); // a no-op on every later run
  });
});

describe("mock users match the seed", () => {
  it.each(Object.entries(MOCK_USERS))("%s is the seed row, with the same manager", (_key, mock) => {
    expect(byId.get(mock.id)).toEqual({
      id: mock.id,
      name: mock.name,
      email: mock.email,
      role: mock.role,
      manager_id: mock.manager_id,
    });
  });

  it("gives the mock manager and HR admin no manager, and the mock employee the mock manager", () => {
    expect(MOCK_USERS.hrAdmin.manager_id).toBeNull();
    expect(MOCK_USERS.manager.manager_id).toBeNull();
    expect(MOCK_USERS.employee.manager_id).toBe(MOCK_USERS.manager.id);
  });
});
