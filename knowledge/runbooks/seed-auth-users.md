# Runbook: create the demo Auth accounts (TASK-024)

Creates (or resets the password of) one Supabase Auth account for each email in `supabase/seed.sql`
(seven today). Safe to re-run. Run it from **your own PowerShell**, never from Vercel or CI.
The service-role key bypasses every security rule: never paste it into chat, a file, a commit or Vercel.

## Run

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"      # Project Settings -> API
$env:SUPABASE_SERVICE_ROLE_KEY = "<service_role key>"         # Project Settings -> API Keys
$env:DEMO_PASSWORD = "<the shared demo password>"             # at least 8 characters
$env:SUPABASE_ANON_KEY = "<anon key>"                         # optional: also proves each sign-in

npm run auth:seed            # dry run: prints the project host and the emails, writes nothing
npm run auth:seed -- --yes   # creates / updates the accounts, then signs in as each (if anon key set)

Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY, Env:DEMO_PASSWORD, Env:SUPABASE_ANON_KEY
```

## Reading the output

- `created` / `updated` per email, then `sign-in ok` per email, then a summary line. Exit code 1 if anything failed.
- Nothing printed contains the key or the password.

## Before the demo

- Sign-ups off: Supabase -> Authentication -> Sign In / Providers -> "Allow new users to sign up" off.
- Switch off `ALLOW_MOCK_LOGIN` on Vercel and redeploy.
- Hand the shared password to the people who need it directly (nothing is emailed).
