import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_KINDS } from "@/lib/db/types";

/**
 * TASK-052 AC3: kind is text + CHECK (an enum value can never be removed), so the TypeScript list
 * and the CHECK list are kept in step by hand. This fails when only one of them is edited.
 */
describe("notifications.kind: types.ts mirrors the migration (TASK-052 AC3)", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20261020000000_notifications.sql"),
    "utf8",
  );

  it("NOTIFICATION_KINDS equals the notifications_kind_check list", () => {
    const check = /notifications_kind_check\s+check \(kind in \(([^)]*)\)\)/.exec(migration);
    expect(check).not.toBeNull();
    const kinds = [...check![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(kinds).toEqual([...NOTIFICATION_KINDS]);
  });

  it("the table has RLS on and keeps no policy (deny-by-default)", () => {
    expect(migration).toMatch(/alter table public\.notifications enable row level security/);
    expect(migration).not.toMatch(/create policy/i);
  });
});
