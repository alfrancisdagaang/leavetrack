import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { getReviewerName, HR_REVIEWER } from "@/lib/leave/reviewer";

const MARCO = "00000000-0000-4000-8000-000000000002";

type Call = { text: string; values: unknown[] };

/** A fake postgres.js client: records the statement and answers with the rows given. */
function fakeSql(rows: unknown[]) {
  const calls: Call[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
    return Promise.resolve(rows);
  }) as unknown as Sql;
  return { sql, calls };
}

describe("getReviewerName", () => {
  it("looks the manager up from the session user's own row, with that id as the only parameter", async () => {
    const { sql, calls } = fakeSql([{ manager_name: "Hana Reyes" }]);
    expect(await getReviewerName(sql, MARCO)).toBe("Hana Reyes");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain("left join public.users m on m.id = u.manager_id");
    expect(calls[0]?.text).toContain("where u.id = ?");
    expect(calls[0]?.values).toEqual([MARCO]);
  });

  it("reads as HR for a person with no manager", async () => {
    const { sql } = fakeSql([{ manager_name: null }]);
    expect(await getReviewerName(sql, MARCO)).toBe(HR_REVIEWER);
    expect(HR_REVIEWER).toBe("HR");
  });

  it("reads as HR when the user row is not found", async () => {
    const { sql } = fakeSql([]);
    expect(await getReviewerName(sql, MARCO)).toBe("HR");
  });
});
