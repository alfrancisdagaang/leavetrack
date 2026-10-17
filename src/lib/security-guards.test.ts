import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-level guards for TASK-025 AC3. They read the repository, so they keep a mistake from
 * creeping back in later: a service-role key in app code, or a secret handed to the logger.
 */

const ROOT = process.cwd();
const SELF = relative(ROOT, __filename);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sourceFiles = walk(join(ROOT, "src")).filter(
  (f) => /\.(ts|tsx)$/.test(f) && relative(ROOT, f) !== SELF,
);
const appFiles = sourceFiles.filter((f) => !/\.test\.(ts|tsx)$/.test(f));
const read = (file: string) => readFileSync(file, "utf8");

describe("TASK-025 AC3: no service-role key in the app", () => {
  // The identifiers the key would travel under (SUPABASE_SERVICE_ROLE_KEY, serviceRoleKey, ...).
  // Prose that explains the rule ("the service-role key is never an app variable") is allowed.
  // Built from parts so this file does not match its own pattern.
  const SERVICE_ROLE = new RegExp(
    `${["service", "role"].join("_")}|${["service", "Role"].join("")}`,
    "i",
  );

  it("is never referenced by identifier anywhere under src", () => {
    const hits = sourceFiles
      .filter((f) => SERVICE_ROLE.test(read(f)))
      .map((f) => relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  it("is never exposed to the browser through a NEXT_PUBLIC_ variable", () => {
    const files = [join(ROOT, ".env.example"), join(ROOT, "src/lib/env.ts")];
    const pattern = /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE|PRIVATE|PASSWORD)/;
    expect(files.filter((f) => pattern.test(read(f))).map((f) => relative(ROOT, f))).toEqual([]);
  });
});

describe("TASK-025 AC3: nothing secret is handed to the logger", () => {
  // The first object argument of logger.<level>({ ... }, "msg"), read up to its closing brace.
  const LOG_CALL = /logger\.(?:debug|info|warn|error|fatal)\(\s*\{([^}]*)\}/g;
  const FORBIDDEN_KEY =
    /(?:^|[\s,{])(cookies?|authorization|password|token|access_token|refresh_token|headers|body|reason)\s*[:,}]/;

  it("passes no cookie, token, header, body or leave reason as a log field", () => {
    const hits: string[] = [];
    for (const file of appFiles) {
      for (const match of read(file).matchAll(LOG_CALL)) {
        if (FORBIDDEN_KEY.test(` ${match[1]},`)) {
          hits.push(`${relative(ROOT, file)}: ${match[0].replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("finds the log calls it is meant to check", () => {
    const calls = appFiles.flatMap((f) => [...read(f).matchAll(LOG_CALL)]);
    expect(calls.length).toBeGreaterThan(10);
  });
});
