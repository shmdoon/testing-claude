# Decisions log

Low-risk choices made where the brief was silent, plus places where safety for
minors overrode a requirement. Newest at the bottom of each section.
**❓ = needs your confirmation.**

## Stack & tooling

| # | Decision | Why |
|---|----------|-----|
| D1 | Next.js **16.4** (latest stable) with `cacheComponents` + `partialPrefetching` on (scaffold defaults). Session reads always sit inside `<Suspense>`; area chrome is prerendered, gated content streams. | Matches "statically cached where possible"; it is the direction of the framework. |
| D2 | `src/proxy.ts` (Next 16 rename of middleware, Node runtime) only refreshes the Supabase session and redirects signed-out users. Role checks happen in layouts/pages via the DAL (`src/lib/auth/dal.ts`). | Proxy can't cheaply hit the DB; role must come from `profiles`. `@opennextjs/cloudflare` ≥1.20 supports Next ≥16.4.1 — verify Node proxy support in M8. |
| D3 | shadcn/ui components are vendored by hand (`components.json` kept) because `ui.shadcn.com` is blocked in the build sandbox. Same source as the CLI would produce, `new-york` style, `radix-ui` package. | Unblocks work; future `npx shadcn add` works on a normal machine. |
| D4 | Font: Lexend via `next/font` (self-hosted at build, no runtime Google request). | Designed for reading fluency; no third-party requests for students. |
| D5 | i18n: tiny typed dictionary (`src/i18n`) with `t("a.b", vars)` instead of a library. Add `hi.ts` to enable Hindi. | Zero deps; keys are type-checked. Revisit (e.g. next-intl) when Hindi ships. |
| D6 | `database.types.ts` is hand-maintained in the exact `supabase gen types` shape until a project is linked; `npm run db:types` regenerates it. | No Supabase project/Docker in the sandbox. |
| D7 | DB tests run plain SQL against a throwaway Postgres (`scripts/test-db.sh`) with a small stub of Supabase's `auth` schema and roles. | Real RLS tests in CI without Docker/Supabase CLI. |
| D8 | Supabase key names follow the new API keys: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) and `SUPABASE_SECRET_KEY` (`sb_secret_…`). Legacy anon/service_role JWT keys also work in the same variables. | Current Supabase recommendation. |
| D9 | `@playwright/test` pinned to `1.63.0` to match the pre-installed browsers. | Avoids browser download. |

## Data model & security

| # | Decision | Why |
|---|----------|-----|
| S1 | Emails stored lower-cased `text` with a CHECK, not `citext`. | Avoids extension-schema issues with `search_path=''` functions. |
| S2 | Security-definer helpers (`is_admin`, `is_staff`, `is_parent_of`) live in a `private` schema that PostgREST doesn't expose. | Supabase best practice; no RLS recursion. |
| S3 | Grants are revoked then added back minimally (column-level `UPDATE (full_name, class_level, locale)` on profiles). Role, status and parent email can't be changed by the user even if an RLS policy were wrong. | Defence in depth. |
| S4 | Signup metadata can only choose `student` or `parent`. Staff roles are granted only through `admin_set_role()` (admin-only, can't change own role, writes `audit_log` in the same transaction). First admin: see `docs/SETUP.md`. | Never trust the client for role. |
| S5 | `audit_log` is append-only (no `updated_at`, no update/delete grants). | Immutable record; the brief's `updated_at` rule doesn't fit append-only tables. |
| S6 | Login never reveals whether an email has an account (always moves to "enter code"). | Prevents discovering which children use the platform. |
| S7 | A student who signed up via Google with no details is `pending_profile` and must finish at `/signup/complete` (student: name/class/parent email; or parent). Only `pending_profile` accounts may switch to parent — a student awaiting consent can't, otherwise they could skip consent. | Closes a consent bypass. |
| S8 | Students are `pending_consent` until a parent consents. M1 shows a banner; lesson content is gated when the consent flow lands (M7). | Consent email needs Resend (M7). |
| S9 | Rate limiting uses a Postgres fixed-window counter (`consume_rate_limit`, service-role only). It fails **open** if the limiter errors; Supabase Auth's own OTP limits still apply. | Host-agnostic (no Redis/KV); one tiny table. |
| S10 | Class levels offered at signup: 7 and 8 (`CLASS_LEVELS`); DB accepts 1–12 for future growth. | Brief scope. |

## External tools & tasks (requirement update 2026-11-03)

| # | Decision | Why |
|---|----------|-----|
| E1 | External tools (Google Stitch, Google AI Studio, Netlify, …) always open in a new tab with `rel="noopener noreferrer"`; never iframed. | They need their own login and block framing. |
| E2 | `external_tools` is admin-managed (M2, `/admin/tools`); lessons reference tools by id. Disabling a tool switches every lesson that uses it to its fallback without editing content. A tool row also stores the **allowed submission domains** (e.g. `*.netlify.app`) used for URL validation. | One place to swap/disable. |
| E3 | ✅ **Age check (confirmed 2026-11-03).** We don't collect date of birth (data minimisation). Estimated age = class level + 5 (Class 7 → 12), compared with the tool's minimum age. Below minimum, or tool disabled → fallback block (teacher demo video / do it with a parent on the adult's account / alternative tool). | Safer default: under-estimates age. |
| E4 | Submission URL checks run server-side: https only, host must match the tool's allowlist, DNS resolution rejects private/loopback/link-local/CGNAT/metadata IPs, redirects are followed manually and re-checked (max 3), 5 s timeout, `HEAD` then small `GET`, response body discarded. | Prevents SSRF. |
| E5 | Screenshots/files go to a private `submissions` bucket (path `user_id/…`), size + MIME limits, read through short-lived signed URLs by the student, linked parent and staff. | Kids' uploads are never public. |
| E6 | "Away on external task" time = launch → return, capped at 2× estimated minutes, stored in its own aggregate (not `activity_minutes`), always labelled **estimated** in dashboards. | We can't measure time on other sites. |
| E7 | Approving a submission marks that lesson step complete; needs-revision reopens the submit panel with the teacher's feedback. Reviewers: `admin` and `content_editor` (✅ confirmed 2026-11-03). Content editors still never see payments. | Brief has no teacher role yet. |
| E8 | Gallery is opt-in twice: the student ticks "share in gallery" on submission, and the parent's consent covers it (togglable from `/parent`). It shows first name + class only, never email/surname. Screenshots are re-served through the app, not public bucket URLs. Can be withdrawn any time. | Minors' privacy. |

## Content model & Studio (Milestone 2)

| # | Decision | Why |
|---|----------|-----|
| C1 | Versioning: one mutable **draft** row + immutable **published** rows per lesson in `lesson_versions`. Publishing copies the draft to version n+1 and repoints `lessons.published_version_id`. A trigger blocks edits/deletes of published rows (except cascades when the lesson itself is deleted). | Students in progress keep their version (M3 stores `lesson_version_id` on progress). |
| C2 | `lessons` holds metadata only (public for published courses); block content lives in `lesson_versions` and is readable by staff, by anyone for **free-preview** lessons, and (M3/M5) by enrolled students. | Paid content never leaks through the public API. |
| C3 | `embed_sim` iframes: https only, host allowlist in code (`APPROVED_SIM_HOSTS`), `sandbox="allow-scripts allow-same-origin"`, no referrer. Adding a host is a code change + review. | Child safety; avoids arbitrary embeds. |
| C4 | Studio block editor (M2): typed block list with id/phase controls and a **JSON props editor validated live by Zod**, plus a phase-grouped live preview. Purpose-built form editors per block type are a later improvement. | Ships every block type now, the schema stays the single source of truth. |
| C5 | Block JSON is validated in the app (Zod) on save, on publish and again before rendering. The `save_lesson_draft`/`publish_lesson` RPCs are staff-only but don't re-run Zod, so invalid blocks are skipped by the renderer, not shown. | Editors are trusted staff; renderer is defensive. |
| C6 | Positions change only through `reorder_modules`/`reorder_lessons` (full set required); course status only through `set_course_status` (needs ≥1 published lesson, audited). Only admins can delete courses. | Consistent ordering; audited publishing. |
| C7 | Seed content is authored in TypeScript (`src/content/seed/data.ts`), validated by the same Zod schemas and compiled to `supabase/seed.sql` (`npm run db:seed:gen`); a unit test fails if seed.sql is stale. Fixed UUIDs → idempotent. | Content team can change samples safely. |
| C8 | Public catalogue reads use a cookie-less anon client inside `"use cache"` with tag `catalog` (1 h), invalidated by `updateTag` from Studio/admin actions. Failed fetches are cached for seconds only. | Fast static pages, instant updates after publish. |
| C9 | Unknown `/courses/[slug]` pages render the not-found page with `noindex` but HTTP 200, because the page streams (documented Next.js behaviour). | Keeps the fast streaming shell; SEO-safe via noindex. |
| C10 | Every session-bound Supabase client calls `await connection()` first, so auth/role checks always run per request and never inside a prefetched App Shell. | Supabase token checks use the clock; also keeps role changes immediate. |
| C11 | React 19 resets forms after each action; failed actions echo submitted values (`echoOnError`) so users never lose input. Passwords/tokens/files are never echoed. | Usability. |
| C12 | Tool minimum ages in the seed (AI Studio 18, Stitch 18, Netlify 13) are placeholders — **verify against each provider's current terms** and adjust in `/admin/tools`. | Legal accuracy for minors. |
| C13 | Course covers: public `course-media` bucket (2 MB, PNG/JPEG/WebP/GIF/SVG), staff-only writes via storage RLS; served through `next/image`. Student uploads will use a separate private bucket (M3). | Covers are public marketing assets; kids' work never is. |
