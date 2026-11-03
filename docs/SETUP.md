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

## 4. Tests

- `npm run test:db` needs PostgreSQL 15+ binaries locally (`initdb`, `pg_ctl`, `psql`) **or** a `DATABASE_URL`.
- `npx playwright install chromium` once before `npm run test:e2e`.
- `npm run test:e2e:live` runs signed-in flows (Studio, admin tools, catalogue) against the project in
  `.env.local`. It creates throwaway `@example.com` users/content via the secret key and deletes them afterwards.
