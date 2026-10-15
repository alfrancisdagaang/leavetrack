import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * US-08 guard. `leave_balances` holds the confirmed balance per type, so every statement that
 * changes it must be reviewed against "touches only the request's own leave type". Today only
 * a decision (decide.ts) and the monthly accrual (accrual.ts) write it. A new writer fails
 * this test until someone has reviewed it and added it here on purpose.
 */
const SRC = fileURLToPath(new URL("../../", import.meta.url));
const ALLOWED = ["lib/leave/accrual.ts", "lib/leave/decide.ts"];
const WRITE = /\b(insert\s+into|update|delete\s+from)\s+public\.leave_balances\b/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("who writes leave_balances", () => {
  it("only the decision and accrual code paths contain a write", () => {
    const writers = sourceFiles(SRC)
      .filter((file) => WRITE.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file).split("\\").join("/"))
      .sort();
    expect(writers).toEqual(ALLOWED);
  });
});
