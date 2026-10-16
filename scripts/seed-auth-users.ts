// Local-only: creates (or resets the password of) a Supabase Auth account for every seeded user.
// TASK-024 / ADR-LeaveTrack-E003. Run it from your own shell; never from Vercel or CI.
//
//   $env:SUPABASE_URL = "https://<ref>.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<service-role key>"   # never commit, paste or log this
//   $env:DEMO_PASSWORD = "<shared demo password>"
//   $env:SUPABASE_ANON_KEY = "<anon key>"                   # optional: also proves each sign-in
//   npm run auth:seed            # dry run: shows the target and the emails, writes nothing
//   npm run auth:seed -- --yes   # does it
//
// This file reads process.env directly, on purpose: AGENTS.md rule 9 (config via getEnv()) is for
// the app. The service-role key must never become an app variable, so it never enters env.ts.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  ensureAccount,
  parseSeedEmails,
  validateInputs,
  type AccountResult,
} from "./seed-auth-users.lib.ts";

const out = (line: string) => process.stdout.write(`${line}\n`);

async function main(): Promise<number> {
  const inputs = validateInputs(process.env);
  const emails = parseSeedEmails(
    readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8"),
  );

  out(`Target project: ${new URL(inputs.url).host}`);
  out(`Accounts (${emails.length}): ${emails.join(", ")}`);
  if (!process.argv.includes("--yes")) {
    out("Dry run: nothing written. Re-run with --yes to create or update these accounts.");
    return 0;
  }

  const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(inputs.url, inputs.serviceRoleKey, noSession).auth.admin;

  const counts: Record<AccountResult, number> = { created: 0, updated: 0 };
  let failures = 0;
  for (const email of emails) {
    try {
      const result = await ensureAccount(admin, email, inputs.password);
      counts[result] += 1;
      out(`${result.padEnd(8)} ${email}`);
    } catch (err) {
      failures += 1;
      out(`FAILED   ${email}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  if (inputs.anonKey) {
    const anon = createClient(inputs.url, inputs.anonKey, noSession);
    for (const email of emails) {
      const { error } = await anon.auth.signInWithPassword({ email, password: inputs.password });
      if (error) failures += 1;
      out(`${error ? "SIGN-IN FAILED" : "sign-in ok"} ${email}`);
      await anon.auth.signOut();
    }
  } else {
    out("Sign-in check skipped (set SUPABASE_ANON_KEY to prove each account can sign in).");
  }

  out(`Done: ${counts.created} created, ${counts.updated} updated, ${failures} failed.`);
  return failures === 0 ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    out(`Error: ${err instanceof Error ? err.message : "unknown error"}`);
    process.exitCode = 1;
  },
);
