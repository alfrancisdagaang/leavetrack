# Retro: sign-in page redesign

Built from the ChatGPT mockup (image 10). Sign-in behaviour is unchanged (`actions.ts`, `page.tsx`, the auth library untouched); no change under `docs/`.

## What shipped

- Split layout from `lg` (navy brand panel with the logo, the tagline and a calendar-and-clock SVG, beside the form); a single card below `lg`. One `h1` "Sign in", a welcome line, the footer "Need access? Ask HR to add your email."
- A password show/hide toggle (`password-field.tsx`): still one `password` input in the form, a labelled `type="button"` with `aria-pressed`, 44px. Email gets `autoCapitalize="none"`; the button shows a spinner while signing in.
- Dropped from the mockup on purpose: the visible demo account (`hr@demo.com` / `demo123`, which does not exist and must never be shown), a "Use demo account" button, and the mockup's wording of the errors (the real messages are kept). The mock card is unchanged and appears only while `ALLOW_MOCK_LOGIN` is true.

## Found while validating

- **Static assets were behind the sign-in gate.** `proxy.ts` redirected signed-out requests for `/icons/*` and `/icon.svg` to `/login`, so the logo on the sign-in page was a broken image (and the tab icon would not load there). Fixed in the matcher (`icons/` and `icon.svg` are skipped, with a test that fails without the fix). No data is exposed: they are brand icons.
- **Login tests were not running.** Vitest only includes `*.test.ts`, so `login-view.test.tsx` and `page.test.tsx` never ran. Renamed to `.ts` (JSX replaced by `createElement`); both pass. Any other `.test.tsx` would be skipped the same way (none left).

## Validation

Gate in a throwaway copy (lint, format, typecheck, 766 tests, build). Browser on a production build as a signed-out visitor at 1440, 1024, 768, 375, 320: split at 1024 and up, no horizontal scroll, the toggle flips the type, label and `aria-pressed` (44px), tab order email, password, toggle, Sign in, the pending state shows, the error appears in a `role="alert"` linked by `aria-describedby`. Contrast from the tokens: white on navy 13.3, `nav-muted` on navy 7.9, `ink-muted` on white 5.3 (4.9 on the page background). With JavaScript off the page renders and the form is a POST form.

## Not verified / backlog

- A successful real sign-in (needs Supabase; the throwaway copy has none, so submit answers "Sign-in is unavailable").
- **The email field is cleared after a failed sign-in** (React 19 resets form fields after an action). It was like this before; keeping the typed email would need the action to return it. Backlog.
- Without JavaScript only the page render and the POST form were checked; a full no-JS submit was not tried, so whether the error message shows there is unverified (it comes from `useActionState`, as before).
