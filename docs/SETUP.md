# Local setup

## 1. Supabase project

1. Create a project at supabase.com (free tier is fine for development).
2. **Project Settings → API Keys**: copy the URL, the *publishable* key and the *secret* key into `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`).
3. Apply migrations: set `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN` in `.env.local`, then
   `npm run db:migrate` (`-- --dry` lists pending only). It runs over HTTPS via the Management API and records
   versions in `supabase_migrations.schema_migrations`, so `npx supabase db push` remains interchangeable.
4. Seed sample content: `npm run db:seed` (runs `supabase/seed.sql`; regenerate it from TypeScript with
   `npm run db:seed:gen` after editing `src/content/seed/data.ts`).
5. `npm run db:types` regenerates `src/lib/supabase/database.types.ts`; review the diff and commit it.

> In the Claude cloud sandbox, Node's `fetch` needs `NODE_USE_ENV_PROXY=1` to use the egress proxy
> (e.g. `NODE_USE_ENV_PROXY=1 npm run db:migrate`). Not needed on a normal machine.

## 2. Auth settings (Authentication → …)

- **URL Configuration**: Site URL `http://localhost:3000`; add redirect URLs
  `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/confirm` (plus production equivalents).
- **Sign In / Providers → Email**: enable; keep "Confirm email" on. OTP length 6.
- **Email Templates → Magic Link** and **Confirm signup** — include both the code and a cross-device link:

  ```html
  <h2>Your sign-in code</h2>
  <p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
  <p>Or <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">sign in with this link</a>.</p>
  ```
- **Google** (optional): create an OAuth client in Google Cloud, add the Supabase callback URL shown
  in the provider panel, paste client id/secret into Supabase, then set `AUTH_GOOGLE_ENABLED=true`.
- **Custom SMTP (needed for real use):** Supabase's built-in mailer allows only a few emails per hour and
  rejects many addresses. Configure Resend under Authentication → Emails → SMTP before inviting real users.

## 3. First admin

Sign up normally, then run in the SQL editor (this bypasses the app on purpose; later role
changes go through `/admin/users`, which calls `admin_set_role` and writes the audit log):

```sql
update public.profiles set role = 'admin', account_status = 'active'
where email = 'you@example.com';
```

## 4. Parent approval & WhatsApp

A new student stays *pending* until a parent approves. After the child's first sign-in the parent gets a WhatsApp
link to `/consent/<token>`. Without WhatsApp API keys the message waits at **/admin/whatsapp** — tap
"Open in WhatsApp", send, then "Mark as sent". Admins can also approve from the student page (note required).

**Automatic sending (WhatsApp Cloud API):**
1. Meta Business → WhatsApp → add and verify a business phone number (or use a BSP such as Gupshup/Interakt that
   exposes the Cloud API). Put `WHATSAPP_PHONE_NUMBER_ID` and a permanent system-user token `WHATSAPP_TOKEN` in the env.
2. WhatsApp Manager → Message templates → create these (language `en`, or set `WHATSAPP_TEMPLATE_LANGUAGE`).
   Body variables in this order — the wording can differ, see `src/lib/whatsapp/templates.ts` for ours:
   | template | category | variables |
   |---|---|---|
   | `consent_request` | Utility | {{1}} child first name, {{2}} approval link |
   | `payment_link` | Utility | {{1}} child, {{2}} course, {{3}} amount, {{4}} link |
   | `invoice_ready` | Utility | {{1}} child, {{2}} course, {{3}} amount, {{4}} invoice no., {{5}} link |
   | `refund_processed` | Utility | {{1}} child, {{2}} course, {{3}} amount, {{4}} credit-note link |
   | `weekly_summary` | Utility | {{1}} child, {{2}} time, {{3}} lessons, {{4}} streak, {{5}} highlight |
   | `project_feedback` | Utility | {{1}} child, {{2}} lesson, {{3}} result, {{4}} feedback |
3. Restart — `/admin/whatsapp` shows "WhatsApp Cloud API (automatic)". Failed sends fall back to the outbox.

**Secrets:** set `LINK_SECRET` (random 32+ chars, signs invoice links) and `CRON_SECRET`.

**Weekly summary:** schedule a weekly `GET https://<domain>/api/cron/weekly-summary` with header
`Authorization: Bearer <CRON_SECRET>` (Vercel Cron, Cloudflare Cron Trigger, or any scheduler) — e.g. Sunday 18:00 IST.
Running it twice in a week is harmless.

To skip approval for a local test student: `update profiles set account_status = 'active' where email = '…';`

## 5. Payments (Razorpay) and email (Resend)

**Without keys (now):** payments run on the **mock gateway** (localhost only) and emails are logged to
`email_log`. Everything — orders, coupons, invoices (TEST series), refunds, credit notes — works end to end.

**Switch to Razorpay test mode:**
1. Razorpay Dashboard → *Test mode* → Settings → API Keys → generate. Put `RAZORPAY_KEY_ID` (`rzp_test_…`) and
   `RAZORPAY_KEY_SECRET` in the environment.
2. Settings → Webhooks → *Add*: URL `https://<your-domain>/api/webhooks/razorpay`, a strong secret
   (→ `RAZORPAY_WEBHOOK_SECRET`), events **payment.captured**, **payment.failed**, **refund.processed**.
   (For local testing use a tunnel such as `cloudflared tunnel --url http://localhost:3000`.)
3. Restart. `/admin/settings` shows "Payment gateway: Razorpay". The mock is disabled automatically when all three are set.
4. Keep "Auto-capture payments" on (Settings → Payment capture) — orders are fulfilled on capture.

**Go live:** generate *Live mode* keys + a live-mode webhook with the same three events, replace the three variables,
make sure `PAYMENTS_ALLOW_MOCK` is unset/false, and do one small real purchase + refund.

**Invoices:** fill in `/admin/settings` (business name, address, GSTIN, GST mode/rate, SAC) after talking to your
accountant. New invoices use the new values; issued ones never change.

**Resend:** add and verify your sending domain in Resend, set `RESEND_API_KEY` and `EMAIL_FROM`
(e.g. `AI Learning Hub <billing@yourdomain.in>`). Also configure Resend as Supabase Auth's custom SMTP (§2).

## 6. Marketing & ads

- **Landing pages:** `/` (main, indexed) and campaign variants `/lp/ai-for-kids`, `/lp/future-skills`, `/lp/screen-time`
  (not indexed). Edit or add variants, testimonials (real ones only) and stats in `src/content/marketing.ts`.
- **Ad links:** always add UTM tags, e.g.
  `https://<domain>/lp/ai-for-kids?utm_source=google&utm_medium=cpc&utm_campaign=ai-for-kids-nov`
  (Meta: `utm_source=meta&utm_medium=paid_social`). The first tagged visit is remembered for 90 days and shows up
  on leads and signups. See results at `/admin/leads` (grouped by campaign; CSV export).
- **Tags (optional):** set `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID` + `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL`
  (conversion action for leads) and/or `NEXT_PUBLIC_META_PIXEL_ID`. They load only on the landing pages, after the
  visitor accepts cookies, and never for signed-in users. The lead form fires `generate_lead` / Google Ads conversion / Meta `Lead`.
- **Before running ads:** replace the legal placeholders (privacy, terms, refund) — ad platforms check these pages —
  and mention cookies/ads measurement in the privacy policy.

## 7. Tests

- `npm run test:db` needs PostgreSQL 15+ binaries locally (`initdb`, `pg_ctl`, `psql`) **or** a `DATABASE_URL`.
- `npx playwright install chromium` once before `npm run test:e2e`.
- To try buying locally: sign in as an active student → course → "Pay now" (mock gateway).
- `npm run test:e2e:live` runs signed-in flows (Studio, admin tools, catalogue) against the project in
  `.env.local`. It creates throwaway `@example.com` users/content via the secret key and deletes them afterwards.
