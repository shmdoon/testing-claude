-- =============================================================================
-- Milestone 1 — Foundation
-- profiles, parent_student_links, consents, settings, audit_log
-- + role helpers, signup trigger, RLS on every table.
--
-- Conventions (see docs/DECISIONS.md):
--   * UUID primary keys, created_at / updated_at on every mutable table.
--   * Emails stored lower-cased in plain text (no citext dependency).
--   * Security-definer helpers live in the non-exposed `private` schema.
--   * Clients get the narrowest grants; privileged writes go through
--     server code using the service role or SECURITY DEFINER RPCs.
-- =============================================================================

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('student', 'parent', 'content_editor', 'admin');
create type public.account_status as enum ('pending_profile', 'pending_consent', 'active', 'suspended');
create type public.link_status as enum ('pending', 'active', 'revoked');
create type public.consent_status as enum ('pending', 'granted', 'withdrawn', 'expired');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user. Role lives here, never in the client.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null check (email = lower(email)),
  full_name      text check (char_length(full_name) between 1 and 120),
  role           public.app_role not null default 'student',
  account_status public.account_status not null default 'pending_profile',
  class_level    smallint check (class_level between 1 and 12),
  parent_email   text check (parent_email = lower(parent_email)),
  locale         text not null default 'en' check (locale in ('en', 'hi')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index profiles_email_key on public.profiles (email);
create index profiles_role_idx on public.profiles (role);
create index profiles_parent_email_idx on public.profiles (parent_email) where parent_email is not null;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- parent_student_links — a parent can have many students and vice versa.
-- ---------------------------------------------------------------------------
create table public.parent_student_links (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid not null references public.profiles (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  status      public.link_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint parent_student_links_unique unique (parent_id, student_id),
  constraint parent_student_links_not_self check (parent_id <> student_id)
);

create index parent_student_links_student_idx on public.parent_student_links (student_id);
-- parent_id is covered by the unique (parent_id, student_id) index.

create trigger parent_student_links_set_updated_at
  before update on public.parent_student_links
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- consents — verifiable parental consent for a student account.
-- token_hash stores a SHA-256 of the emailed token, never the token itself.
-- ---------------------------------------------------------------------------
create table public.consents (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles (id) on delete cascade,
  parent_email    text not null check (parent_email = lower(parent_email)),
  parent_id       uuid references public.profiles (id) on delete set null,
  status          public.consent_status not null default 'pending',
  token_hash      text unique,
  token_expires_at timestamptz,
  policy_version  text,
  granted_at      timestamptz,
  withdrawn_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index consents_student_idx on public.consents (student_id);
create index consents_parent_idx on public.consents (parent_id);
create index consents_parent_email_idx on public.consents (parent_email);

create trigger consents_set_updated_at
  before update on public.consents
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- settings — business / tax / platform settings, editable by admins.
-- ---------------------------------------------------------------------------
create table public.settings (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z][a-z0-9_.]*$'),
  value       jsonb not null,
  description text,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index settings_updated_by_idx on public.settings (updated_by);

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_log — append-only record of privileged actions.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (char_length(action) between 1 and 100),
  target_type text,
  target_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_target_idx on public.audit_log (target_type, target_id);

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so policies can read profiles without
-- recursing into profiles' own RLS).
-- ---------------------------------------------------------------------------
create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'admin', false);
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() in ('admin', 'content_editor'), false);
$$;

create or replace function private.is_parent_of(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.parent_student_links l
    where l.parent_id = auth.uid()
      and l.student_id = p_student_id
      and l.status = 'active'
  );
$$;

revoke all on function private.current_app_role() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_staff() from public;
revoke all on function private.is_parent_of(uuid) from public;
grant execute on function private.current_app_role() to anon, authenticated, service_role;
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.is_staff() to anon, authenticated, service_role;
grant execute on function private.is_parent_of(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Signup: create a profile for every new auth user.
-- Only 'student' or 'parent' can come from signup metadata; staff roles are
-- granted exclusively by an admin (see public.admin_set_role).
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta          jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role        public.app_role;
  v_name        text := nullif(btrim(left(meta ->> 'full_name', 120)), '');
  v_class       smallint;
  v_parent      text := nullif(lower(btrim(meta ->> 'parent_email')), '');
  v_status      public.account_status;
begin
  v_role := case when meta ->> 'signup_role' = 'parent' then 'parent'::public.app_role
                 else 'student'::public.app_role end;

  if (meta ->> 'class_level') ~ '^\d{1,2}$'
     and (meta ->> 'class_level')::int between 1 and 12 then
    v_class := (meta ->> 'class_level')::smallint;
  end if;

  -- Reject malformed parent emails rather than failing signup.
  if v_parent is not null and v_parent !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    v_parent := null;
  end if;
  if v_parent = lower(new.email) then
    v_parent := null; -- a student cannot be their own parent
  end if;

  if v_role = 'parent' then
    v_status := 'active';
    v_class := null;
    v_parent := null;
  elsif v_name is not null and v_class is not null and v_parent is not null then
    v_status := 'pending_consent';
  else
    v_status := 'pending_profile';
  end if;

  insert into public.profiles (id, email, full_name, role, account_status, class_level, parent_email)
  values (new.id, lower(new.email), v_name, v_role, v_status, v_class, v_parent);

  if v_role = 'student' and v_parent is not null then
    insert into public.consents (student_id, parent_email) values (new.id, v_parent);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Student completes their profile (e.g. after Google signup).
-- Server action validates input first; this RPC enforces it again.
-- ---------------------------------------------------------------------------
create or replace function public.complete_student_profile(
  p_full_name text,
  p_class_level smallint,
  p_parent_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_parent text := lower(btrim(p_parent_email));
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select email into v_email from public.profiles
  where id = v_uid and role = 'student' and account_status = 'pending_profile';
  if not found then
    raise exception 'profile cannot be completed' using errcode = '42501';
  end if;

  if char_length(btrim(p_full_name)) not between 1 and 120
     or p_class_level not between 1 and 12
     or v_parent !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or v_parent = v_email then
    raise exception 'invalid profile data' using errcode = '22023';
  end if;

  update public.profiles
     set full_name = btrim(p_full_name),
         class_level = p_class_level,
         parent_email = v_parent,
         account_status = 'pending_consent'
   where id = v_uid;

  insert into public.consents (student_id, parent_email) values (v_uid, v_parent);
end;
$$;

revoke all on function public.complete_student_profile(text, smallint, text) from public, anon;
grant execute on function public.complete_student_profile(text, smallint, text) to authenticated;

create or replace function public.complete_parent_profile(p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if char_length(btrim(coalesce(p_full_name, ''))) not between 1 and 120 then
    raise exception 'invalid profile data' using errcode = '22023';
  end if;

  -- Only an account that has not finished onboarding may self-select "parent"
  -- (the same choice the signup form offers). Staff roles are never reachable.
  update public.profiles
     set role = 'parent', full_name = btrim(p_full_name), account_status = 'active',
         class_level = null, parent_email = null
   where id = v_uid and role = 'student' and account_status = 'pending_profile';
  if not found then
    raise exception 'profile cannot be completed' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.complete_parent_profile(text) from public, anon;
grant execute on function public.complete_parent_profile(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: change a user's role (atomic with its audit entry).
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.app_role;
begin
  if not private.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'admins cannot change their own role' using errcode = '42501';
  end if;

  select role into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  update public.profiles
     set role = p_role,
         account_status = case when p_role in ('admin', 'content_editor', 'parent')
                               then 'active'::public.account_status
                               else account_status end
   where id = p_user_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'user.role_changed', 'profile', p_user_id::text,
          jsonb_build_object('from', v_old, 'to', p_role));
end;
$$;

revoke all on function public.admin_set_role(uuid, public.app_role) from public, anon;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;

-- ---------------------------------------------------------------------------
-- rate_limits — fixed-window counters for auth/payment/heartbeat endpoints.
-- Works on any host (no Redis needed). Only the service role may use it.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique check (char_length(key) <= 200),
  window_start timestamptz not null default now(),
  hits         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index rate_limits_window_idx on public.rate_limits (window_start);

/** Returns true if the call is allowed, false if the limit is exceeded. */
create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end,
        updated_at = now()
  returning hits into v_hits;

  -- Opportunistic cleanup keeps the table tiny (~1% of calls).
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Grants: start from nothing, add back the minimum.
-- (Supabase grants ALL to anon/authenticated by default.)
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.parent_student_links, public.consents,
              public.settings, public.audit_log, public.rate_limits
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, class_level, locale) on public.profiles to authenticated;
grant select on public.parent_student_links to authenticated;
grant select on public.consents to authenticated;
grant select, update (value, description, updated_by) on public.settings to authenticated;
grant select on public.audit_log to authenticated;

grant all on public.profiles, public.parent_student_links, public.consents,
             public.settings, public.audit_log, public.rate_limits
  to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.parent_student_links enable row level security;
alter table public.consents             enable row level security;
alter table public.settings             enable row level security;
alter table public.audit_log            enable row level security;
alter table public.rate_limits          enable row level security; -- no policies: service role only

-- profiles
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: parents read linked children" on public.profiles
  for select to authenticated using ((select private.is_parent_of(id)));
create policy "profiles: admins read all" on public.profiles
  for select to authenticated using ((select private.is_admin()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- parent_student_links
create policy "links: participants read" on public.parent_student_links
  for select to authenticated
  using (parent_id = (select auth.uid()) or student_id = (select auth.uid()));
create policy "links: admins read all" on public.parent_student_links
  for select to authenticated using ((select private.is_admin()));

-- consents
create policy "consents: student reads own" on public.consents
  for select to authenticated using (student_id = (select auth.uid()));
create policy "consents: parent reads own" on public.consents
  for select to authenticated using (parent_id = (select auth.uid()));
create policy "consents: admins read all" on public.consents
  for select to authenticated using ((select private.is_admin()));

-- settings
create policy "settings: admins read" on public.settings
  for select to authenticated using ((select private.is_admin()));
create policy "settings: admins update" on public.settings
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()) and updated_by = (select auth.uid()));

-- audit_log
create policy "audit_log: admins read" on public.audit_log
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Default settings (business/tax values are filled in from /admin later).
-- ---------------------------------------------------------------------------
insert into public.settings (key, value, description) values
  ('platform.name', '"AI Learning Hub"', 'Display name of the platform'),
  ('platform.support_email', '""', 'Support contact shown to users'),
  ('consent.policy_version', '"2026-11-draft"', 'Privacy policy version parents consent to')
on conflict (key) do nothing;
