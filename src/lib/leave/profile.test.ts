import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { getProfile } from "@/lib/leave/profile";

const ID = "00000000-0000-4000-8000-000000000003";

/** A fake client that records each statement and its values and answers with `rows`. */
function fakeSql(rows: unknown[]) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return rows;
  };
  return { sql: sql as unknown as Sql, calls };
}

describe("getProfile (TASK-062)", () => {
  it("is ONE statement, scoped to the given user id in the SQL", async () => {
    const { sql, calls } = fakeSql([]);
    await getProfile(sql, ID);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values).toEqual([ID]);
    expect(calls[0]!.text).toMatch(/where u\.id = \?::uuid/);
  });

  it("returns the person with their manager's name (AC1)", async () => {
    const { sql } = fakeSql([
      {
        id: ID,
        name: "Elena Cruz",
        email: "elena.cruz@leavetrack.example",
        role: "employee",
        manager_name: "Marco Santos",
      },
    ]);
    expect(await getProfile(sql, ID)).toEqual({
      id: ID,
      name: "Elena Cruz",
      email: "elena.cruz@leavetrack.example",
      role: "employee",
      managerName: "Marco Santos",
    });
  });

  it("gives a null manager name at the top of the chart (AC2)", async () => {
    const { sql } = fakeSql([
      { id: ID, name: "Hana Ito", email: "h@x.example", role: "hr_admin", manager_name: null },
    ]);
    expect((await getProfile(sql, ID))?.managerName).toBeNull();
  });

  it("returns null for an unknown id", async () => {
    const { sql } = fakeSql([]);
    expect(await getProfile(sql, ID)).toBeNull();
  });

  it("reads only the manager's name: no email or other column of anyone else", async () => {
    const { sql, calls } = fakeSql([]);
    await getProfile(sql, ID);
    expect(calls[0]!.text).toContain("m.name as manager_name");
    // Only the select list matters: the join may use m.id, but nothing else of m is returned.
    const selected = calls[0]!.text.split(/\bfrom\b/)[0]!;
    expect(selected).not.toMatch(/m\.(email|role|id|manager_id)/);
  });
});
