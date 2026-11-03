-- =============================================================================
-- Milestone 4 — Time-on-platform tracking
-- Aggregated, not one row per heartbeat: one row per user × IST day × course × lesson.
-- Credited seconds per accepted heartbeat = min(sent, 30, seconds since the
-- previous accepted heartbeat measured by the DB clock) → a user's total can
-- never exceed real elapsed time, whatever the client sends.
-- =============================================================================

create table public.activity_minutes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  date       date not null,
  course_id  uuid not null references public.courses (id) on delete cascade,
  lesson_id  uuid references public.lessons (id) on delete cascade,
  seconds    integer not null default 0 check (seconds between 0 and 86400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_minutes_unique unique nulls not distinct (user_id, date, course_id, lesson_id)
);
create index activity_minutes_course_date_idx on public.activity_minutes (course_id, date);
create index activity_minutes_lesson_idx on public.activity_minutes (lesson_id);
create index activity_minutes_date_idx on public.activity_minutes (date);
create trigger activity_minutes_set_updated_at before update on public.activity_minutes
  for each row execute function private.set_updated_at();

-- Estimated time away on external tools (launch → return, capped at 2× estimate).
create table public.external_task_minutes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  date       date not null,
  course_id  uuid not null references public.courses (id) on delete cascade,
  lesson_id  uuid references public.lessons (id) on delete cascade,
  seconds    integer not null default 0 check (seconds between 0 and 86400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_task_minutes_unique unique nulls not distinct (user_id, date, course_id, lesson_id)
);
create index external_task_minutes_course_date_idx on public.external_task_minutes (course_id, date);
create index external_task_minutes_lesson_idx on public.external_task_minutes (lesson_id);
create index external_task_minutes_date_idx on public.external_task_minutes (date);
create trigger external_task_minutes_set_updated_at before update on public.external_task_minutes
  for each row execute function private.set_updated_at();

-- One row per user: when we last accepted a heartbeat (rate limit + elapsed cap).
create table public.activity_state (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  last_beat_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger activity_state_set_updated_at before update on public.activity_state
  for each row execute function private.set_updated_at();

/* India-local calendar day for dashboards (see docs/DECISIONS.md T2). */
create or replace function private.ist_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

-- ---------------------------------------------------------------------------
-- record_heartbeat — returns the seconds credited (0 = ignored)
-- ---------------------------------------------------------------------------
create or replace function public.record_heartbeat(
  p_user_id uuid, p_course_id uuid, p_lesson_id uuid, p_seconds integer, p_flush boolean default false
)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_last    timestamptz;
  v_elapsed numeric;
  v_credit  integer;
begin
  if p_seconds is null or p_seconds < 1 then return 0; end if;

  -- Only time on content the user may open counts.
  if p_lesson_id is not null then
    if not exists (select 1 from public.lessons where id = p_lesson_id and course_id = p_course_id)
       or not private.can_access_lesson(p_user_id, p_lesson_id) then
      return 0;
    end if;
  elsif not (
    private.is_enrolled(p_user_id, p_course_id)
    or exists (select 1 from public.profiles where id = p_user_id and role in ('admin', 'content_editor'))
  ) then
    return 0;
  end if;

  insert into public.activity_state (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select last_beat_at into v_last from public.activity_state where user_id = p_user_id for update;

  v_elapsed := case when v_last is null then 30 else extract(epoch from now() - v_last) end;
  -- Regular beats closer than 25 s are extras: ignore. Flushes (page hide) are
  -- accepted but can't credit more than the time actually elapsed.
  if not coalesce(p_flush, false) and v_elapsed < 25 then return 0; end if;

  v_credit := least(p_seconds, 30, floor(v_elapsed)::integer);
  if v_credit <= 0 then return 0; end if;

  update public.activity_state set last_beat_at = now() where user_id = p_user_id;

  insert into public.activity_minutes as a (user_id, date, course_id, lesson_id, seconds)
  values (p_user_id, private.ist_today(), p_course_id, p_lesson_id, v_credit)
  on conflict (user_id, date, course_id, lesson_id)
  do update set seconds = least(a.seconds + excluded.seconds, 86400);

  return v_credit;
end;
$$;

create or replace function public.record_external_away(
  p_user_id uuid, p_course_id uuid, p_lesson_id uuid, p_seconds integer
)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_seconds is null or p_seconds < 1 then return; end if;
  if p_seconds > 21600 then p_seconds := 21600; end if; -- defensive; the app caps at 2× estimate
  insert into public.external_task_minutes as e (user_id, date, course_id, lesson_id, seconds)
  values (p_user_id, private.ist_today(), p_course_id, p_lesson_id, p_seconds)
  on conflict (user_id, date, course_id, lesson_id)
  do update set seconds = least(e.seconds + excluded.seconds, 86400);
end;
$$;

revoke all on function public.record_heartbeat(uuid, uuid, uuid, integer, boolean) from public, anon, authenticated;
revoke all on function public.record_external_away(uuid, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.record_heartbeat(uuid, uuid, uuid, integer, boolean) to service_role;
grant execute on function public.record_external_away(uuid, uuid, uuid, integer) to service_role;
revoke all on function private.ist_today() from public;
grant execute on function private.ist_today() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Grants + RLS (read: self, linked parents, admins; writes: service role only)
-- ---------------------------------------------------------------------------
revoke all on public.activity_minutes, public.external_task_minutes, public.activity_state from anon, authenticated;
grant select on public.activity_minutes, public.external_task_minutes to authenticated;
grant all on public.activity_minutes, public.external_task_minutes, public.activity_state to service_role;

alter table public.activity_minutes      enable row level security;
alter table public.external_task_minutes enable row level security;
alter table public.activity_state        enable row level security; -- no policies: service role only

create policy "activity: read" on public.activity_minutes for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_parent_of(user_id)) or (select private.is_admin()));
create policy "external time: read" on public.external_task_minutes for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_parent_of(user_id)) or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Dashboard views — security_invoker, so the RLS above applies to whoever asks.
-- ---------------------------------------------------------------------------
create view public.daily_activity with (security_invoker = true) as
select coalesce(a.user_id, e.user_id) as user_id,
       coalesce(a.date, e.date) as date,
       coalesce(a.seconds, 0)::integer as active_seconds,
       coalesce(e.seconds, 0)::integer as estimated_external_seconds
from (select user_id, date, sum(seconds) as seconds from public.activity_minutes group by 1, 2) a
full join (select user_id, date, sum(seconds) as seconds from public.external_task_minutes group by 1, 2) e
  on a.user_id = e.user_id and a.date = e.date;

create view public.weekly_activity with (security_invoker = true) as
select user_id,
       date_trunc('week', date)::date as week_start, -- ISO weeks start on Monday
       sum(active_seconds)::integer as active_seconds,
       sum(estimated_external_seconds)::integer as estimated_external_seconds
from public.daily_activity
group by 1, 2;

create view public.lesson_time_stats with (security_invoker = true) as
select a.course_id,
       a.lesson_id,
       count(distinct a.user_id)::integer as students,
       sum(a.seconds)::integer as total_seconds,
       round(sum(a.seconds)::numeric / nullif(count(distinct a.user_id), 0))::integer as avg_seconds_per_student
from public.activity_minutes a
where a.lesson_id is not null
group by 1, 2;

create view public.course_time_stats with (security_invoker = true) as
select a.course_id,
       count(distinct a.user_id)::integer as students,
       sum(a.seconds)::integer as total_seconds,
       round(sum(a.seconds)::numeric / nullif(count(distinct a.user_id), 0))::integer as avg_seconds_per_student
from public.activity_minutes a
group by 1;

grant select on public.daily_activity, public.weekly_activity, public.lesson_time_stats, public.course_time_stats to authenticated;
revoke all on public.daily_activity, public.weekly_activity, public.lesson_time_stats, public.course_time_stats from anon;

/* Daily active + estimated external seconds for one student over a range (RLS applies). */
create or replace function public.get_time_summary(p_user_id uuid, p_from date, p_to date)
returns table (date date, active_seconds integer, estimated_external_seconds integer)
language sql stable security invoker set search_path = '' as $$
  select d.date, d.active_seconds, d.estimated_external_seconds
  from public.daily_activity d
  where d.user_id = p_user_id and d.date between p_from and p_to
  order by d.date;
$$;
revoke all on function public.get_time_summary(uuid, date, date) from public, anon;
grant execute on function public.get_time_summary(uuid, date, date) to authenticated;
