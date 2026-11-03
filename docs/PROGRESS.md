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

**Live project (ikypxrhivcuqsldzuhhr) — 2026-11-03**
- Migration applied with `npm run db:migrate`; types regenerated from the live DB with `npm run db:types`.
- Live checks passed (throwaway users, deleted afterwards): signup trigger + role clamping, pending consent row, RLS for anon/student/parent, admin RPC refused for students, rate limiter, magic-link sign-in → `/learn`, student bounced from `/admin`, sign-out.
- Email sending is limited by Supabase's built-in mailer (`over_email_send_rate_limit` after a few sends). Needs Resend SMTP (see SETUP §2).

**Known issues / notes**
- Student accounts stay `pending_consent`; the consent email + token flow is M7. Until then the dashboard shows a banner only.
- `@opennextjs/cloudflare` compatibility with the Node-runtime `proxy.ts` to be verified in M8.

**Requirement update received (external tools / tasks)** — scheduled into M2/M3/M4/M6, see `docs/PLAN.md` and decisions E1–E8.

**Next:** Milestone 2 — content model + Studio (+ external tools registry and `external_task` block).
