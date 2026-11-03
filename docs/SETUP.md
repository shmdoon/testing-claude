# Local setup

## 1. Supabase project

1. Create a project at supabase.com (free tier is fine for development).
2. **Project Settings → API Keys**: copy the URL, the *publishable* key and the *secret* key into `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`).
3. Apply migrations — either:
   - Supabase CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`, or
   - paste each file in `supabase/migrations/` (in order) into the SQL editor.
4. `npm run db:types` (needs `SUPABASE_PROJECT_REF` and `npx supabase login`) and review the diff.

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
- Production: configure custom SMTP (Resend) — Supabase's built-in mailer is heavily rate limited.

## 3. First admin

Sign up normally, then run in the SQL editor (this bypasses the app on purpose; later role
changes go through `/admin/users`, which calls `admin_set_role` and writes the audit log):

```sql
update public.profiles set role = 'admin', account_status = 'active'
where email = 'you@example.com';
```

## 4. Tests

- `npm run test:db` needs PostgreSQL 15+ binaries locally (`initdb`, `pg_ctl`, `psql`) **or** a `DATABASE_URL`.
- `npx playwright install chromium` once before `npm run test:e2e`.
