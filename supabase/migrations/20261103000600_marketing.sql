-- =============================================================================
-- Marketing: parent leads (from the landing page / ad campaigns) and
-- first-touch campaign attribution on profiles.
-- =============================================================================

create type public.lead_status as enum ('new', 'contacted', 'converted', 'unsubscribed');

create table public.leads (
  id                uuid primary key default gen_random_uuid(),
  parent_email      text not null check (parent_email = lower(parent_email) and char_length(parent_email) <= 254),
  parent_name       text check (char_length(parent_name) <= 120),
  child_class       smallint check (child_class between 1 and 12),
  interest          text check (char_length(interest) <= 60),
  marketing_consent boolean not null default false,
  consent_at        timestamptz,
  status            public.lead_status not null default 'new',
  utm_source        text check (char_length(utm_source) <= 100),
  utm_medium        text check (char_length(utm_medium) <= 100),
  utm_campaign      text check (char_length(utm_campaign) <= 100),
  utm_term          text check (char_length(utm_term) <= 100),
  utm_content       text check (char_length(utm_content) <= 100),
  click_id_type     text check (click_id_type in ('gclid', 'fbclid')),
  landing_path      text check (char_length(landing_path) <= 200),
  referrer_host     text check (char_length(referrer_host) <= 200),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index leads_created_idx on public.leads (created_at desc);
create index leads_email_idx on public.leads (parent_email);
create index leads_campaign_idx on public.leads (utm_campaign, created_at desc);
create index leads_status_idx on public.leads (status);
create trigger leads_set_updated_at before update on public.leads for each row execute function private.set_updated_at();

revoke all on public.leads from anon, authenticated;
grant select on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;
create policy "leads: admin read" on public.leads for select to authenticated using ((select private.is_admin()));

-- First-touch campaign attribution (source/medium/campaign only — no click ids).
alter table public.profiles add column acquisition jsonb
  check (acquisition is null or (jsonb_typeof(acquisition) = 'object' and pg_column_size(acquisition) <= 1024));

create or replace function private.clean_acquisition(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select nullif(jsonb_strip_nulls(jsonb_build_object(
    'utm_source', left(nullif(btrim(p ->> 'utm_source'), ''), 100),
    'utm_medium', left(nullif(btrim(p ->> 'utm_medium'), ''), 100),
    'utm_campaign', left(nullif(btrim(p ->> 'utm_campaign'), ''), 100)
  )), '{}'::jsonb);
$$;

-- Re-create the signup trigger function to also store attribution.
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

  if v_parent is not null and v_parent !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    v_parent := null;
  end if;
  if v_parent = lower(new.email) then
    v_parent := null;
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

  insert into public.profiles (id, email, full_name, role, account_status, class_level, parent_email, acquisition)
  values (new.id, lower(new.email), v_name, v_role, v_status, v_class, v_parent,
          case when jsonb_typeof(meta -> 'acquisition') = 'object' then private.clean_acquisition(meta -> 'acquisition') end);

  if v_role = 'student' and v_parent is not null then
    insert into public.consents (student_id, parent_email) values (new.id, v_parent);
  end if;

  return new;
end;
$$;
