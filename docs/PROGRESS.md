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

## Milestone 4 — Time tracking ✅ (2026-11-03)

**Done**
- Migration `…0400_tracking` (applied to live): `activity_minutes`, `external_task_minutes`, `activity_state`; `record_heartbeat` (access check, 25 s rule, credit ≤ 30 s and ≤ real elapsed), `record_external_away`; security-invoker views `daily_activity`, `weekly_activity`, `lesson_time_stats`, `course_time_stats`; `get_time_summary` RPC.
- `useActivityTracker` (per-second active meter, 30 s heartbeats, sendBeacon flush on page hide/unmount) on lesson pages and enrolled course pages; YouTube play-state detection (`TrackedVideo`, with transcript/captions panel).
- `/api/track/heartbeat` (session user only, Zod, same-origin, 1 KB, 204).
- External away time aggregated separately on return; student dashboard shows "Learning time this week" + "(estimated)" external minutes.
- Discrete learning events from M3 (lesson_started, activity_attempted/completed, reflection_saved, quiz_submitted, lesson_completed, external_task_*) continue to be logged.
- Tests: 180 unit (meter with fake clock, payload, same-origin, IST week), 6 SQL suites (caps, 25 s rule, flush ≤ elapsed, access, aggregation, IST date, RLS on views), live E2E for heartbeats (aggregation, ignored extras, beacon flush, cross-site/junk refused) and external away time + dashboard.

**Known issues / notes**
- Bunny/Cloudflare Stream play state uses the focus heuristic (no player API wired yet).
- Admin/parent analytics UI, charts and CSV export arrive in M6 (the views/RPC are ready).

**Next:** Milestone 5 — payments + invoices (Razorpay orders/checkout/verify/webhook, enrolments, gap-free invoice numbers, PDF, Resend, coupons, refunds). Needs Razorpay test keys + Resend key.

## Milestone 5 — Payments + invoices ✅ (2026-11-03, placeholder keys)

**Done**
- Migration `…0500_payments` (applied to live): `coupons`, `coupon_redemptions`, `orders`, `payments`, `refunds`, `invoices`, `invoice_counters`, `webhook_events`, `email_log`, private `invoices` bucket, placeholder business/tax settings; RPCs `fulfill_order`, `mark_payment_failed`, `process_refund`; gap-free FY numbering; GST math; immutable invoices.
- Razorpay provider (REST, HMAC via Web Crypto) + mock gateway (localhost only) with identical code paths.
- Parent checkout (`/parent/checkout/[course]`): linked child, server-side price + coupon, Razorpay Checkout or mock dialog, `/api/payments/verify`, webhook `/api/webhooks/razorpay` (signature, idempotency, retry-safe).
- Invoices: PDF (pdf-lib), private storage, signed-URL download, email with PDF attached (Resend or log-only); credit notes on refund.
- Parent: children list, purchases with invoice/credit-note downloads. Course pages: "Buy for ₹…" for parents, "ask your parent" for students.
- Admin: `/admin/payments` (filters, refund with reason, CSV), `/admin/invoices` (regenerate, resend), `/admin/coupons`, `/admin/settings` (business/tax/invoice/refund settings, GST requires GSTIN). All audited.
- Tests: 209 unit (money/words, signatures, PDF, CSV, formatting), 7 SQL suites (FY, GST, numbering rollback, idempotent fulfilment, refunds, immutability, RLS incl. editors can't see money), 17 live E2E (purchase with coupon + failed attempt + invoice PDF + email + access; refund → revoke + credit note + CSV; webhook forgery/replay; settings + coupons).

**Fixed along the way**
- `formatInr` showed ₹449.10 as "₹449.1".
- Selects lost the user's choice after a failed submit (settings, coupons, signup class).

**Known issues / notes**
- Running on the mock gateway and log-only email until you add keys (see SETUP §5). Business/tax values are placeholders (tax mode: none).
- Refunds are full-amount only; partial refunds can be added later.
- Parents can buy only for linked children; links are created by the consent flow (M7). Until then, link via SQL (SETUP §6).

## Marketing landing page ✅ (2026-11-03, requested between milestones)

**Done**
- New parent-facing `/`: hero with lesson illustration, trust points, why activity-first, how a lesson works, courses + live prices from the catalogue, a real activity preview, parent features, "safe by design", FAQ, free-lesson lead form, final CTA, sticky mobile CTA.
- Campaign variants `/lp/<key>` from `src/content/marketing.ts` (noindex, canonical `/`, real 404 for unknown keys).
- First-touch UTM attribution cookie → leads and signups (`profiles.acquisition`); `leads` table (migration `…0600_marketing`, applied to live); lead form with adult confirmation, marketing consent, honeypot, rate limits, welcome email.
- `/admin/leads` (per-campaign summary, list, CSV). Optional GA4 / Google Ads / Meta Pixel, consent-gated and landing-page-only.
- SEO: metadata, Open Graph image, JSON-LD (organisation, FAQ, courses), sitemap, robots.
- Lighthouse (mobile, landing): performance 90–93, accessibility 100, best practices 100, SEO 100 (removed Zod from client bundles).
- Tests: 213 unit, 8 SQL suites, 28 offline E2E (landing, lead validation, campaign variants, attribution cookie, robots/sitemap/OG), live E2E for the lead funnel.

**Next:** Milestone 6 — dashboards (student/parent/admin analytics, charts, CSV), `/admin/submissions` review queue, opt-in gallery.

## Milestone 6 — Dashboards, review queue, gallery ✅ (2026-11-04)

**Done**
- Migration `…0700_dashboards` (applied to live): `parent_student_links.gallery_consent`, `admin_overview`, `admin_students`, `admin_engagement`, `gallery_items`.
- Reusable accessible SVG daily chart (validated palette, light/dark, keyboard tooltips, table view) + stat tiles.
- Student: learning streak on the dashboard; `/learn/achievements` (streak, totals, 14-day chart, 9 badges with progress); `/learn/profile` (edit name, approved projects with gallery share switch); `/learn/gallery`.
- Parent: children cards (this week's active + estimated time, lessons done, streak, course progress, approval status); child detail (stat tiles, 30-day chart, courses, recent lessons with quiz scores, projects + teacher feedback, gallery consent switch, badges); `/parent/gallery`.
- Admin: overview (active today/week, revenue this month excl. test, avg time per active student, review/leads/consent counts, 30-day active-students chart, top courses); students (search, time, last active, completion %) + detail (per-course, per-lesson time/attempts/quiz, 30-day chart, recent events, campaign source); engagement (presets + range, group by student/course/lesson, platform chart, CSV); users (role changes, audited).
- Review queue `/studio/submissions` + `/admin/submissions` (status/course filters, link liveness, private previews, approve / needs revision with required feedback, gallery moderation).
- Tests: 225 unit, 9 SQL suites (reports, permissions, gallery rules), 28 offline E2E, live E2E for student/teacher/parent/admin dashboards.

**Known issues / notes**
- Children appear for parents once linked; links are created by the consent flow (M7).
- Admin tables cap at 100–200 rows per view (search/filters narrow); pagination later if needed.

**Next:** Milestone 7 — parent consent flow (email + signed token, creates the parent link), data deletion requests, legal pages content structure, accessibility pass, Lighthouse pass on lesson pages.

## Parents on WhatsApp (requirement update) ✅ (2026-11-04)

**Done**
- Migrations `…0800_whatsapp_parents`, `…0810_invoice_buyer_parent_only` (applied to live): parent contact on the child's profile, WhatsApp consent + gallery fields, `payment_requests`, payer on orders/invoices, `whatsapp_messages` outbox.
- Signup is child-only (parent name, WhatsApp number, optional email, opt-in); `/parent` area removed.
- In-app checkout with payer details + 18+ confirmation; "Ask my parent to pay" → WhatsApp link → `/pay/<token>` (no login).
- Parent approval via WhatsApp link `/consent/<token>`; admin manual approval (audited); resend link.
- WhatsApp sending: Cloud API when keys exist, else `/admin/whatsapp` outbox (wa.me + mark sent). Invoice/refund, weekly summary (cron + button), teacher feedback.
- Signed invoice links; admin student page shows parent contact + gallery permission.
- Tests: 232 unit, 10 SQL suites, 28 offline E2E, 25 live E2E (consent link, pay link, outbox, weekly summary, feedback).

**Needs from you:** WhatsApp Cloud API number + token and the 6 approved templates (SETUP §4), `LINK_SECRET`, `CRON_SECRET` + a weekly schedule. Until then everything works through the manual outbox.

**Next:** Milestone 7 — data deletion requests, legal page content, accessibility + Lighthouse pass on lesson pages.

## Milestone 7 — Data rights, legal pages, accessibility & performance ✅ (2026-11-05)

**Done**
- Migrations `…0900_data_rights`, `…0910_legal_jurisdiction` (applied to live): `deletion_requests`, `account_status 'deleted'`, `erase_student()`, legal settings.
- Student *Profile → Your data*: download all my data (JSON), request deletion (confirm box, optional reason), cancel while pending; parent's WhatsApp number shown masked.
- Admin: record a parent's request from the student page (note required); `/admin/deletions` queue → "Delete data now" (files, learning data, messages, contact details; invoices kept; login deleted or anonymised + banned); all audited.
- Daily `/api/cron/cleanup`: erases accounts not approved by a parent within 30 days; removes stale payment links/rate limits.
- Legal pages rewritten as structured drafts (privacy: children & consent, data list, WhatsApp, processors, retention, rights, grievance officer, security, cookies; terms; refund & cancellation), filled from settings, "Draft" banner until reviewed; signup links terms + privacy.
- Accessibility: axe WCAG 2.1 AA checks (light + dark) on 11 public page types, every student page, all 8 seeded lessons, player steps after interaction, consent, checkout, studio and 14 admin pages — 0 violations. Keyboard-only lesson test (Tab reach, Enter, focus moves to the new step).
- Lighthouse (mobile, production build): landing 97/100/100/100; course page 98–99 / 100 / 100 (CLS 0.19 → 0); lesson pages 91 / 100 / 100 (SEO n/a — signed-in pages are `noindex`); privacy policy 99/100/100/100.
- Tests: 237 unit, 11 SQL suites, 74 offline E2E (incl. 44 axe), live E2E incl. privacy + a11y specs.

**Needs from you:** fill *Admin → Settings → Legal pages & privacy* (grievance officer, privacy email, courts), business name/address, then a lawyer review of `src/content/legal.ts`; schedule `/api/cron/cleanup` daily (SETUP §7).

**Next:** Milestone 8 — deployment docs (Vercel / Cloudflare OpenNext, env, cron, Razorpay + WhatsApp go-live, backups).
