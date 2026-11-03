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
