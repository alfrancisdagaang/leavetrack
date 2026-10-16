import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { findUserByEmail } from "@/lib/auth/users";
import { MOCK_USERS } from "@/lib/mock/users";

function fakeSql(rows: unknown[]) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return rows;
  }) as unknown as postgres.Sql;
  return { sql, calls };
}

describe("findUserByEmail", () => {
  it("AC4: looks up lower(email) in SQL with the session email as the only bound value", async () => {
    const { sql, calls } = fakeSql([MOCK_USERS.employee]);
    const user = await findUserByEmail(sql, "Elena.Cruz@LeaveTrack.example");
    expect(user).toEqual(MOCK_USERS.employee);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).toMatch(/lower\(email\)\s*=\s*lower\(\?\)/);
    expect(calls[0]!.values).toEqual(["Elena.Cruz@LeaveTrack.example"]);
  });

  it("AC2: returns null when there is no row", async () => {
    const { sql } = fakeSql([]);
    expect(await findUserByEmail(sql, "stranger@example.com")).toBeNull();
  });
});
