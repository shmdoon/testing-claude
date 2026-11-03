# Progress

## Milestone 1 — Foundation ✅ (2026-11-03)

**Done**
- Next.js 16.4 (App Router, TS strict, Tailwind v4, Cache Components / partial prerendering), vendored shadcn/ui base components, design tokens (calm base, bright accents, lesson-phase colours), dark mode, Lexend font, 44px+ tap targets, skip link.
- Typed env (Zod) + `.env.example` covering all milestones; typed i18n layer (English).
- Supabase browser/server/service-role clients; `src/proxy.ts` refreshes sessions and redirects signed-out users from protected areas.
- Migration `20261103000100_foundation.sql`: `profiles`, `parent_student_links`, `consents`, `settings`, `audit_log`, `rate_limits`; role helpers in `private`; signup trigger (role clamped to student/parent); `complete_student_profile`, `complete_parent_profile`, `admin_set_role` (audited), `consume_rate_limit`; RLS + minimal grants on every table.
- Auth: email 6-digit code + magic link (`/auth/confirm`, `/auth/callback`), Google OAuth (behind `AUTH_GOOGLE_ENABLED`), student signup (name, class, parent email) and parent signup, `/signup/complete` for Google signups, sign-out. Rate-limited per IP and per email.
- Role-gated layouts for `/learn`, `/parent`, `/admin`, `/studio` (DAL `requireArea`, role from DB), public layout, landing page, catalogue + legal placeholders, admin sub-page placeholders.
- Tests: 53 Vitest unit tests, SQL RLS suites (2 files), 20 Playwright tests (mobile + desktop). CI workflow runs all of them.

**Known issues / notes**
- Not yet exercised against a real Supabase project (no credentials in the sandbox) — signed-in flows need a manual check once keys are provided (see below).
- Student accounts stay `pending_consent`; the consent email + token flow is M7. Until then the dashboard shows a banner only.
- `@opennextjs/cloudflare` compatibility with the Node-runtime `proxy.ts` to be verified in M8.

**Requirement update received (external tools / tasks)** — scheduled into M2/M3/M4/M6, see `docs/PLAN.md` and decisions E1–E8.

**Next:** Milestone 2 — content model + Studio (+ external tools registry and `external_task` block).
