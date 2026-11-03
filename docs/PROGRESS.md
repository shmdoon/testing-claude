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

## Milestone 2 — Content model + Studio ✅ (2026-11-03)

**Done**
- Migrations `…0200_content`, `…0210_content_storage`, `…0220_lessons_course_id_grant` (applied to live): `courses`, `modules`, `lessons`, `lesson_versions` (draft + immutable published versions), `external_tools`; RLS + column grants; staff RPCs `save_lesson_draft`, `publish_lesson`, `reorder_modules`, `reorder_lessons`, `set_course_status` (audited); public `course-media` bucket with staff-only writes.
- Zod schemas for all 16 block types incl. `external_task` (tool id, goal, steps with screenshots, starter prompts, minutes, submission types, fallback: demo video / with parent / alternative tool), phase rules, lesson-order + publish checks.
- Block registry (label, template, preview renderer) + safe Markdown renderer; player renderers plug in at M3.
- Seed: "What is AI?" (mini, free, 2 lessons) and "AI Explorers" (big, ₹499, 2 × 3 lessons) using every block type, 3 external tools, and the Netlify external-task lesson with a with-parent fallback. Loaded into the live project.
- Studio: course list/create/edit (₹ → paise, class levels, outcomes, cover upload), publish/unpublish, modules/lessons CRUD with drag-to-reorder + accessible up/down buttons, lesson editor (add/duplicate/move/delete blocks, live Zod validation, phase-grouped preview, save draft, publish → version, version history + load into editor), lesson settings (activity-first gating flag, free preview).
- `/admin/tools` registry (enable/disable, min age, submission-domain allowlist), audited.
- Public `/courses` with filters (class, size, price, topic — plain GET form), `/courses/[slug]` (outcomes, locked/preview lesson list, price, first-activity preview), featured courses on the landing page; cached and refreshed on publish.
- Tests: 116 unit, 4 SQL suites, 20 offline E2E, 6 live E2E (editor builds + publishes a course end-to-end; admin tool CRUD + audit; catalogue/filters/detail/404).

**Fixed along the way**
- Forms lost user input after a failed submit (React 19 auto-reset) → values are echoed back on error (all forms incl. signup).
- Session clients now opt out of prefetched shells (`connection()`), removing "Date.now() while prerendering" errors.

**Known issues / notes**
- Enroll/Buy buttons are disabled placeholders until enrolment (M3, free) and payments (M5).
- Block props are edited as validated JSON (typed form editors later — C4).
- Tool minimum ages need verifying against providers' terms (C12).
- Seeded YouTube video is a placeholder — replace with a Class 7–8 explainer with captions.

**Next:** Milestone 3 — lesson player (stepper, interactive renderers incl. external task launch/return/submit + fallback, responses, progress, enrolment for free courses).

## Milestone 3 — Lesson player ✅ (2026-11-03)

**Done**
- Migration `…0300_learning` (applied to live): `enrollments`, `lesson_progress` (pinned to a version), `block_responses`, `external_submissions`, `learning_events`, private `submissions` bucket; `recompute_lesson_progress` (completion in SQL) and `review_submission` (staff; approval completes the step; audited). Students only read; all writes are server-side after access checks.
- Free enrolment (`/learn/[course]`), course map with per-lesson status and progress bar, dashboard with "continue where you left off" and course progress; public course page "Start learning for free" / "Try the free preview lesson".
- Lesson player stepper: Try it → Notice → Understand → Check → Done. Activity-first enforced on the server (module/check content isn't sent until the activity is attempted). Resumes at the step that still needs work.
- Interactive players for every block type via a registry (drag-sort with keyboard buttons, match pairs, fill-in-the-blanks, predict-then-reveal, explore choices, sandboxed simulation, upload work, checklist, reflection, quiz with server grading + retry), each wrapped in an error boundary.
- External tasks: launch in a new tab (`noopener noreferrer`, event logged), return detected → submit panel (link / screenshot / file / text), status + teacher feedback + resubmission, gallery opt-in, age/disabled fallbacks (with parent, demo video, alternative tool, or acknowledge-and-continue).
- Safety: quiz answers never sent to the browser; uploads type-sniffed and EXIF/GPS-stripped; URL submissions checked against the tool allowlist with private-IP/redirect protection; per-user rate limits on all player actions; pending-consent students blocked from enrolling/saving (S8 revised).
- Tests: 164 unit, 5 SQL suites, 20 offline E2E, 11 live E2E (full lesson incl. gating + quiz retry; external task launch/return/screenshot EXIF strip/revision/URL/approval; age fallback; consent + enrolment gates; every activity type; studio; admin tools; catalogue). Live suite now cleans up after aborted runs.

**Fixed along the way**
- Match-pairs crashed the whole lesson (event read in a deferred updater) → fixed + per-block error boundaries.
- Upload/link forms were reset by React after failed submits → typed links and chosen files are kept on error.
- Studio reorder now shows "Saving order… / Order saved".

**Known issues / notes**
- The teacher review UI (`/admin/submissions`) and gallery page come in M6; reviews work today via the `review_submission` RPC (used by the tests).
- Away-on-external-task seconds are logged per return; aggregation + dashboards in M4/M6.
- Paid courses still need payments (M5); preview lessons are open to active students.

**Next:** Milestone 4 — time tracking (heartbeat hook, `activity_minutes` aggregate, rate limit, sendBeacon, external "estimated" minutes aggregate, SQL views/RPCs).
