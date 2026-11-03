# AI Learning Hub

Activity-first learning platform for Class 7–8 students (Next.js 16 + Supabase).
Every lesson goes **Activity → Reflection → Module → Quick check → Done**.

- Plan: [`docs/PLAN.md`](docs/PLAN.md) · Progress: [`docs/PROGRESS.md`](docs/PROGRESS.md) · Decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Local setup (Supabase, auth emails, first admin): [`docs/SETUP.md`](docs/SETUP.md)

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase values
npm run dev
```

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · `tsc` (after `next typegen`) |
| `npm test` | Vitest unit tests |
| `npm run test:db` | Applies all migrations to a throwaway Postgres and runs `supabase/tests/*.test.sql` (RLS tests). Uses `DATABASE_URL` if set. |
| `npm run test:e2e` | Playwright (builds + starts the app; signed-out flows work without Supabase) |
| `npm run check` | lint + typecheck + unit + db |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` from the linked project |

## Layout

```
src/app/(public)     landing, catalogue, legal, login/signup
src/app/learn        student area      (student, admin)
src/app/parent       parent area       (parent, admin)
src/app/studio       Content Studio    (content_editor, admin)
src/app/admin        admin area        (admin)
src/lib/auth         roles, data-access layer (requireArea), server actions
src/lib/supabase     browser / server / service-role clients, proxy helper, DB types
src/i18n             UI strings (English; Hindi-ready)
supabase/migrations  SQL migrations (source of truth for the schema)
supabase/tests       SQL RLS tests
```
