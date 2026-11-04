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
| S8 | **Revised in M3 (safer option):** students are `pending_consent` until a parent consents, and until then they can browse but **cannot enrol, open lessons or save any answers/uploads** (enforced in `can_access_lesson`, the enrolled-read RLS policy and every server action). Before the consent email ships (M7), activate a test student with the SQL in `docs/SETUP.md`. | Processing a child's learning data needs verifiable parental consent first (DPDP Act). |
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

## Lesson player (Milestone 3)

| # | Decision | Why |
|---|----------|-----|
| P1 | Students only **read** learning tables. Enrolments, progress, responses, submissions and events are written by server actions with the service role after access checks; completion is computed in SQL (`recompute_lesson_progress`). | Scores and completion can't be forged from the browser. |
| P2 | Quiz answers and explanations are stripped before blocks reach the browser and are graded server-side. Activities are re-graded on the server too; their content (e.g. match pairs) is visible to the browser because activities are formative. Drag-sort items are shuffled per student. | Fair quiz scores shown to parents; low-stakes activities stay instant. |
| P3 | Activity-first is enforced server-side: until an activity is attempted, the page payload contains **only** activity blocks, and `setPhase` refuses to advance. | "Can't skip to the module" is real, not just hidden UI. |
| P4 | Progress is pinned to the lesson version a student started; they keep it (and RLS lets them read it) even after a new version is published. | Brief requirement. |
| P5 | Lesson completion = every interactive block complete. External tasks complete only on **approval**; with only reviews pending the lesson is `awaiting_review`. Demo-video fallbacks, and tasks whose tool is unusable with no fallback, complete on acknowledgement so nobody is stuck. | "Approval completes the lesson step." |
| P6 | Uploads (upload_work, screenshots, files): ≤5 MB, type checked by magic bytes (PNG/JPEG/WebP, PDF where allowed — never SVG/HTML), EXIF/XMP/GPS stripped in pure JS, stored in the private `submissions` bucket under `user_id/`. | Children's photos often contain home location. |
| P7 | URL submissions: https only, host must match the tool's `submission_domains`, IP literals rejected, DNS-resolved private/loopback/link-local/metadata IPs rejected, manual redirects (max 3, re-checked), 5 s timeout. An unreachable site is still accepted and marked for the reviewer; a policy violation is rejected. Residual risk: DNS rebinding between check and fetch — limited by the allowlist (e.g. only `*.netlify.app`). | SSRF protection without blocking kids on a slow host. |
| P8 | "Away on external task" seconds are logged on return (`external_task_returned`, capped at 2× estimate, flagged `estimated`) and aggregated separately in M4. | Requirement E6. |
| P9 | Staff (admin/content editor) can open any lesson in the player (their progress is stored like a student's, which doubles as QA). Tool age limits don't apply to staff. | Easy content QA. |

## Time tracking (Milestone 4)

| # | Decision | Why |
|---|----------|-----|
| T1 | The browser measures active seconds once per second (tab visible AND input in the last 60 s, OR a video playing) and sends them every 30 s; the **server credits min(sent, 30, seconds since its last accepted beat)**. Regular beats < 25 s after the last accepted one are ignored; page-hide flushes are accepted but capped by elapsed time. | A user's total can never exceed real wall-clock time, whatever a modified client sends. |
| T2 | Days are **India time** (`Asia/Kolkata`); weeks start Monday. | Students and admin are in India; "today"/"this week" should match their calendar. |
| T3 | `activity_minutes` keeps one row per user × day × course × lesson (`unique nulls not distinct`); course-page time has `lesson_id = null`. Only time on content the user may open is counted (enrolled/preview/staff). | Small DB (≈ a few rows per active student per day). |
| T4 | Heartbeats go to `/api/track/heartbeat` (Route Handler), cookie session only, same-origin check (Origin/Referer), ≤1 KB body, always `204`. | sendBeacon can't set headers; CSRF-style inflation is blocked; nothing leaks. |
| T5 | "Video playing" comes from the YouTube iframe API (`enablejsapi=1` + postMessage state events). Bunny/Cloudflare players fall back to "focus is inside the video iframe". | No third-party scripts loaded for tracking. |
| T6 | External "away" time (launch → return, capped 2× estimate) goes to `external_task_minutes`, never mixed with active time, and is always shown with "(estimated)". | Requirement E6. |
| T7 | Dashboards read security-invoker views (`daily_activity`, `weekly_activity`, `lesson_time_stats`, `course_time_stats`) and `get_time_summary()`, so RLS decides who sees what (self, linked parents, admins). | One access model for tables and reports. |

## Payments & invoices (Milestone 5)

| # | Decision | Why |
|---|----------|-----|
| M1 | **Only parents (or admins) pay**, and only for a linked, consented child. Students see "ask your parent". | Minors can't enter contracts in India; payments come from an adult. |
| M2 | Price, discount and total are computed on the server from the DB (`quote`); the browser never sends an amount. Coupons: percent or flat, optional course/expiry/usage limit, one use per buyer; counted on capture. A 100% coupon completes without the gateway (provider `free`). | Brief §7. |
| M3 | Razorpay via REST + Web Crypto HMAC (no SDK). Checkout success → `/api/payments/verify` checks the signature AND fetches the payment; it fulfils only if `captured`. The webhook is the source of truth; both paths call the same idempotent `fulfill_order` (one DB transaction: payment, order, enrolment, coupon, invoice number). Webhooks are deduplicated by `x-razorpay-event-id`; a failed handler un-records the event so Razorpay's retry can succeed. | Correct under races, retries and replays; host-agnostic. |
| M4 | **Mock gateway** when Razorpay keys are absent: only on localhost or with `PAYMENTS_ALLOW_MOCK=true` (never in production). It signs and sends real-shaped webhooks through the same handler. Mock invoices use `TEST-TINV`/`TEST-TCN` series (never consuming real numbers), are stamped "TEST DOCUMENT", and are the only invoices that can be deleted. | Full flow testable without keys, zero risk to real numbering. |
| M5 | Invoice numbers: `PREFIX/YYYY-YY/NNNNNN` per Indian financial year (April–March, IST), from a locked counter row inside the fulfilment transaction → no gaps, no duplicates. Credit notes have their own series (`CN/…`). | GST rules. |
| M6 | GST: prices are tax-inclusive; taxable = round(total × 100 / (100 + rate)); CGST/SGST split with the odd paisa to SGST, or IGST, or none. Default **none** (placeholder until registered; GST can't be enabled without a GSTIN). Seller details, SAC and rates are **snapshotted** on each invoice; issued invoices are immutable (only PDF path/email timestamp can change). | Accountant can change settings later without altering history. |
| M7 | Invoice PDFs: `pdf-lib` (pure JS, works on Vercel and Cloudflare) instead of `@react-pdf/renderer`; Latin-1 standard fonts, so "₹" prints as "INR" (Hindi needs an embedded font later). Stored in the private `invoices` bucket; downloads go through `/api/invoices/[id]` (RLS: buyer or admin) → 60-second signed URL. | Hosting-agnostic. |
| M8 | Refunds: admin-initiated, full amount only for now; recorded + audited before calling the gateway; on `refund.processed` (webhook) → order refunded, enrolment revoked, credit note issued + emailed. One open refund per order. | Brief §7.5. |
| M9 | Email via Resend REST; without `RESEND_API_KEY` emails are logged only. `email_log` stores recipient, template, subject, status — never bodies. | Placeholder-friendly; minimal data. |
| M10 | Content editors can never read orders, payments, invoices or coupons (RLS). Admin CSV export is audited and protected against spreadsheet formula injection. | Brief §3; data hygiene. |

## Marketing landing page & campaigns

| # | Decision | Why |
|---|----------|-----|
| MK1 | `/` is a parent-facing landing page; ad campaigns get variants at `/lp/<key>` configured in `src/content/marketing.ts` (headline, sub-headline, CTA, meta). Variants are `noindex` with canonical `/`; unknown keys return a real 404 (checked in the proxy, since `dynamicParams` isn't available with Cache Components). | Marketers can add an ad-specific page without code changes elsewhere; no duplicate-content SEO issues. |
| MK2 | Ad/analytics tags (GA4, Google Ads, Meta Pixel) are optional env IDs, load **only on `/` and `/lp/*`**, only after cookie consent, and **never for signed-in users**. Not on `/signup`, `/login`, `/courses` or any app area — children visit those. Only the parent lead form reports a conversion. | Brief: no third-party trackers for students; DPDP consent. |
| MK3 | First-touch attribution: UTM params (+ only the *type* of click id, never its value) captured by the proxy into an httpOnly first-party cookie (90 days), attached to leads (full UTM set) and to signups (`profiles.acquisition`: source/medium/campaign only). | Measure campaigns without third-party cookies or personal identifiers. |
| MK4 | Leads: parent email (+ optional name, child's class), mandatory "I'm a parent/guardian (18+)" confirmation, optional marketing consent (timestamped), honeypot + IP/email rate limits, welcome email with the free-course link. Admin view + audited CSV. | Collect from adults only; consent recorded. |
| MK5 | No invented social proof: testimonials and stats render only when real entries are added to `src/content/marketing.ts`. | Honesty; advertising standards. |
| MK6 | SEO: metadata + Open Graph/Twitter, generated share image (`opengraph-image.tsx`), JSON-LD (EducationalOrganization, FAQPage, Course list with INR offers), `sitemap.xml`, `robots.txt` (app areas, API and `/lp/` disallowed). | Organic + social sharing. |
| MK7 | Performance: client bundles must not import Zod modules (constants like `CLASS_LEVELS`, `PHASES` live in zod-free files). Landing mobile Lighthouse went 74 → 90–93. | Brief: Lighthouse mobile ≥ 85. |

## Dashboards, review & gallery (Milestone 6)

| # | Decision | Why |
|---|----------|-----|
| D1 | Charts are hand-built SVG (no chart library) following the dataviz method: palette slots blue/orange validated with `validate_palette.js` in light AND dark (separate dark steps), ≤24px columns, 4px rounded tops, 2px surface gap between stacked segments, hairline grid, legend for ≥2 series, per-column tooltip on hover **and keyboard focus**, a table view, whole-number ticks for counts. | Accessible, light (no extra JS library), consistent in both themes. |
| D2 | Every time chart shows **active** time and **estimated** external time as separate, labelled series — never summed into one number. | Requirement E6. |
| D3 | Admin reports run as `security definer` SQL functions that first check `is_admin()` (`admin_overview`, `admin_students`, `admin_engagement`); per-student views reuse `getStudentStats()` with the caller's client so RLS decides (self / linked parent / admin). Revenue excludes mock-gateway orders (shown separately as "test"). | One access model; reports stay fast in SQL. |
| D4 | Badges and streaks are computed from existing data (no tables): streak = consecutive India-time days with active time, counted from today or yesterday. | Nothing extra to keep in sync. |
| D5 | Review queue lives at `/studio/submissions` (content editors + admins, decision E7) and `/admin/submissions`. Reviews go through `review_submission` (staff check + audit in SQL). The queue shows only first name + class; private uploads are previewed via 5-minute signed URLs. Reviewed cards stay in place with their outcome. | Least data for reviewers; smooth queue work. |
| D6 | Gallery is **members-only** (active accounts and staff), never public: an approved URL/screenshot project appears only if the student shared it AND a linked parent turned on `gallery_consent`. First name + class only; screenshots are re-served by the app (`/api/gallery/[id]`) after an eligibility check; outbound links use `noopener noreferrer nofollow ugc`. Students can withdraw anytime (profile), parents can switch consent off, staff can remove an item. | Minors' privacy (E8). Note for reviewers: check that a project page itself doesn't show a surname/photo before approving. |
| D7 | Role management uses `admin_set_role` (audited; can't change own role). | S4. |

## Parents on WhatsApp, no parent dashboard (requirement update 2026-11-04)

Supersedes the parent-account parts of M1, M5 and M6 above.

- **W1 One account per child.** Every signup is a student account; the parent's name, WhatsApp number (required)
  and email (optional) are stored on the child's profile. The `/parent` area is removed; legacy `parent` profiles
  land on `/`. `parent_student_links` stays in the schema (unused) so old data isn't lost.
- **W2 Payment inside the child's account.** `/learn/checkout/[course]` records the payer (name, phone, optional
  email) and requires "I am a parent/guardian, 18+" — a minor can't be the contracting party. Invoices are issued
  to the parent (never the child's email; fallback "Parent/guardian of <child>"). "Ask my parent to pay" sends a
  7-day payment link on WhatsApp → `/pay/[token]` works without logging in (token hashed in DB, single course,
  marked paid on fulfilment, noindex).
- **W3 Parental consent kept, but via WhatsApp.** DPDP Act §9 requires verifiable parental consent for under-18s,
  and the brief says pick the safer option for minors. After the child proves the email (first sign-in — never at
  raw signup, so strangers can't make us message arbitrary numbers) the parent gets a WhatsApp link
  `/consent/[token]` (hashed, 7 days, single use) to approve, opt in to updates and optionally allow the gallery.
  Admins can approve on the parent's behalf (note required, audited) after a call/WhatsApp chat. *Can be relaxed
  if your lawyer advises otherwise — the flow is isolated in `src/lib/consent`.*
- **W4 Sending "Both".** WhatsApp Cloud API template messages when `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`
  are set; otherwise (or if the API fails) the message goes to the `/admin/whatsapp` outbox with an
  "Open in WhatsApp" (wa.me) button and "Mark as sent". Every message is stored (`whatsapp_messages`) for audit.
- **W5 Messages.** `consent_request`, `payment_link`, `invoice_ready`, `refund_processed`, `weekly_summary`,
  `project_feedback` (`src/lib/whatsapp/templates.ts` — names/parameter order must match approved templates).
  Updates only go to parents who opted in; consent/payment/invoice are transactional.
- **W6 Links in messages** are random tokens (hashed at rest) or HMAC-signed short-lived links (invoice PDFs,
  `LINK_SECRET`) — no login needed, nothing guessable, no personal data in URLs.
- **W7 Weekly summary** via `/api/cron/weekly-summary` (Bearer `CRON_SECRET`) or the admin button; idempotent per
  child per 7-day window.
- **W8 Gallery permission** is now `profiles.gallery_consent`, set by the parent on the consent page or by an
  admin on the student page (when the parent says yes on WhatsApp). Student opt-in per project still applies.
