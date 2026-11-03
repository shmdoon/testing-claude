# AI Learning Hub — Build Plan

Source brief: the project brief in the initial task (activity-first learning platform).
This file holds the task breakdown for the **current** milestone plus a short outline of
the rest. Decisions live in `docs/DECISIONS.md`, status in `docs/PROGRESS.md`.

## Milestone 1 — Foundation

| # | Task | Done when |
|---|------|-----------|
| 1.1 | Scaffold Next.js 16 (App Router, TS strict, Tailwind v4, ESLint) | `npm run build` passes |
| 1.2 | shadcn/ui setup (`components.json`, `cn()` util, base components: button, input, label, card, badge, separator, dropdown) | components render in both themes |
| 1.3 | Design tokens: calm neutral base + bright accents, radius, focus ring, large tap targets, dark mode (`next-themes`) | tokens in `globals.css`, theme toggle works |
| 1.4 | Typed env loading with Zod (`src/lib/env.ts`), `.env.example` listing **every** variable for all milestones | unit test covers missing/invalid env |
| 1.5 | i18n layer (`src/i18n`) — English dictionary, typed `t()` helper, ready for Hindi | all UI strings go through it |
| 1.6 | Supabase wiring: browser / server / service-role (server-only) clients, `proxy.ts` session refresh | session cookies refresh on navigation |
| 1.7 | Migrations: extensions, enums, `profiles`, `parent_student_links`, `consents`, `settings`, `audit_log`, `updated_at` trigger, role helper functions, signup trigger, RLS on every table | applied cleanly on a fresh Postgres |
| 1.8 | Hand-maintained `database.types.ts` in the exact `supabase gen types` shape + `npm run db:types` script for when the CLI is linked | typecheck passes |
| 1.9 | Auth: email OTP (6-digit code) + magic link + Google OAuth; `/login`, `/signup` (student asks for name, class, parent email; parent signup), `/auth/callback`, `/auth/confirm`, sign-out | flows work against a Supabase project |
| 1.10 | Roles: `requireUser()` / `requireRole()` data-access layer, role read from `profiles` (never the client), role-based home redirect | unit-tested role matrix |
| 1.11 | Layouts: public, `/learn`, `/parent`, `/admin`, `/studio` — each with its own shell + server-side role gate; placeholder pages | Playwright: unauthenticated users are redirected |
| 1.12 | Placeholder legal pages (`/legal/privacy`, `/legal/terms`, `/legal/refund`), landing page skeleton, `/courses` placeholder | pages render |
| 1.13 | Tests: Vitest unit tests, SQL RLS tests run on a throwaway local Postgres (`npm run test:db`), Playwright happy path | `npm run check` green |
| 1.14 | CI workflow: lint, typecheck, unit, db, e2e | workflow file committed |

## Milestone 2 — Content model + Studio

| # | Task | Done when |
|---|------|-----------|
| 2.1 | Migration: `courses`, `modules`, `lessons`, `lesson_versions` (one mutable draft + immutable published versions per lesson), `external_tools`; RLS; reorder + publish RPCs (audited); public `course-media` bucket | RLS tests green, applied to live |
| 2.2 | Zod block schemas (all 16 types incl. `external_task`), phase rules, lesson-level validation | unit tests |
| 2.3 | Block registry (`src/content/blocks/registry.tsx`): label, kind, allowed phases, template, preview renderer — player renderers plug in in M3 | adding a type = one schema + one registry entry |
| 2.4 | Seed authored in TypeScript, validated by Zod, compiled to `supabase/seed.sql` (2 courses, every block type, 3 external tools, one external-task lesson) | test proves coverage + seed.sql up to date |
| 2.5 | Studio: course list/create/edit (cover upload, price in ₹ stored as paise), modules + lessons CRUD with drag-to-reorder (+ keyboard buttons), lesson editor (typed block list, per-block JSON props validated live, phase-grouped preview), save draft, publish → version, version history | Playwright happy path as editor |
| 2.6 | `/admin/tools` registry CRUD (enable/disable, min age, allowed submission domains) | admin-only |
| 2.7 | Public catalogue `/courses` with filters + `/courses/[slug]` detail (outcomes, lesson list locked/unlocked, price, preview of first activity), cached + invalidated on publish | e2e |

## Milestone 3 — Lesson player

| # | Task | Done when |
|---|------|-----------|
| 3.1 | Migration: `enrollments`, `lesson_progress` (pinned to a version), `block_responses`, `external_submissions`, `learning_events`; private `submissions` bucket; access helper; `review_submission` + `recompute_lesson_progress`. Students only READ their rows; all writes go through server actions (service role) after access checks, so scores can't be forged. | RLS tests |
| 3.2 | Grading (pure, shared): activities graded on the server from the stored block; quiz answers stripped before sending to the browser and graded server-side | unit tests |
| 3.3 | Safety libs: EXIF/GPS stripping for uploaded photos (JPEG/PNG/WebP, pure JS), magic-byte type sniffing, SSRF-safe URL check (https, tool allowlist, private-IP block, manual redirects, 5 s timeout) | unit tests |
| 3.4 | Free enrolment (active students only), `/learn/[course]` course map with progress, dashboard "continue where you left off" | e2e |
| 3.5 | Lesson player stepper Activity → Reflection → Module → Check → Done with activity-first gating; interactive renderers for every block type via the registry | e2e |
| 3.6 | External task: launch in new tab (event), return detection → submit panel (url/screenshot/file/text), status + feedback, age/disabled fallback, gallery opt-in | e2e |
| 3.7 | Consent gate: lesson responses/enrolment need `account_status = active` (decision S8 revised) | RLS + e2e |

## Milestone 4 — Time-on-platform tracking

| # | Task | Done when |
|---|------|-----------|
| 4.1 | Migration: `activity_minutes` (daily aggregate per user/course/lesson, IST date), `external_task_minutes` (estimated, separate), `activity_state` (one row per user: last accepted beat); `record_heartbeat` RPC: access check, 25 s rate limit, credit = min(sent, 30, server-measured elapsed) so totals can never exceed wall-clock time; `record_external_away`; security-invoker views for daily/weekly totals and per-lesson/course averages + `get_time_summary` RPC | SQL tests |
| 4.2 | `/api/track/heartbeat`: session user only, Zod payload, same-origin check, tiny body, 204 always | unit + e2e |
| 4.3 | `useActivityTracker`: per-second active meter (tab visible AND input in last 60 s, OR a video playing), heartbeat every 30 s, `sendBeacon` flush on page hide; video-playing signal from the YouTube iframe API + focus heuristic | unit tests with a fake clock |
| 4.4 | External "away" time → `external_task_minutes` on return (capped 2× estimate) | e2e |
| 4.5 | Student dashboard: "this week" active minutes + estimated external minutes (labelled) | e2e |

## Later milestones (outline — detailed when started)

2. **Content model + Studio** — content tables + versioning, Zod block schemas & registry, Studio CRUD with reorder, seed 2 courses using every block type.
   - **External tools** (requirement update 2026-11-03): `external_tools` registry (name, logo, base URL, allowed submission domains, minimum age, requires-account, enabled), admin CRUD at `/admin/tools`; `external_task` block (tool id, goal, numbered steps + optional screenshots, copyable starter prompts, estimated minutes, submission types url/screenshot/file/text, optional fallback block). Seed: one lesson using an external task (Netlify).
3. **Lesson player** — stepper (Activity → Reflection → Module → Check → Done), all block renderers, gating, `block_responses`, `lesson_progress`.
   - `external_task` renderer: "Launch tool" opens a new tab (`noopener,noreferrer`) and logs `external_task_started`; on return (`visibilitychange`/`focus`) show the "Submit your work" panel; fallback shown when the tool is disabled or the student is below its minimum age.
   - `external_submissions` (submitted / approved / needs_revision + teacher feedback), private `submissions` bucket for screenshots/files, server-side URL check (https only, tool domain allowlist, DNS-resolved private/internal IPs blocked, no redirects to other hosts, ~5 s timeout).
4. **Tracking** — `useActivityTracker`, `/api/track/heartbeat`, `activity_minutes` upsert RPC with 30 s cap and 25 s rate-limit, `sendBeacon`, `learning_events`.
   - Away-on-external-task time: from launch to return, capped at 2× estimated minutes, stored separately (`external_task_minutes`), never mixed into active time.
5. **Payments + invoices** — orders, coupons, Razorpay order/checkout/verify/webhook (idempotent), enrollments, gap-free invoice numbers, PDF, Resend, refunds + credit notes.
6. **Dashboards** — student, parent, admin analytics via SQL views/RPC, charts, CSV export.
   - Estimated external time shown separately and labelled "estimated".
   - `/admin/submissions` review queue (filters: status, course, lesson, tool, date) with approve / needs-revision + feedback; approval completes the lesson step.
   - Opt-in gallery of approved projects (first name only, student + parent opt-in, revocable).
7. **Consent + legal + polish** — parent consent email + signed token, data deletion request, a11y + Lighthouse pass.
8. **Deployment docs** — `docs/DEPLOY.md` (Vercel Pro, Cloudflare/OpenNext), env, Razorpay live switch, backups.
