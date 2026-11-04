-- =============================================================================
-- Milestone 6 — dashboards, gallery consent, report RPCs
-- =============================================================================

-- Parent's permission for the child's approved projects to appear in the gallery.
alter table public.parent_student_links add column gallery_consent boolean not null default false;

/* India-local month / week helpers */
create or replace function private.ist_now() returns timestamp
language sql stable set search_path = '' as $$ select now() at time zone 'Asia/Kolkata'; $$;

-- ---------------------------------------------------------------------------
-- Admin overview (one JSON document for the dashboard)
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := private.ist_today();
  v_week  date := date_trunc('week', v_today)::date;
  v_month timestamptz := (date_trunc('month', private.ist_now()) at time zone 'Asia/Kolkata');
  v jsonb;
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;

  select jsonb_build_object(
    'students_total', (select count(*) from public.profiles where role = 'student'),
    'students_pending_consent', (select count(*) from public.profiles where role = 'student' and account_status = 'pending_consent'),
    'active_today', (select count(distinct user_id) from public.activity_minutes where date = v_today and seconds > 0),
    'active_week', (select count(distinct user_id) from public.activity_minutes where date >= v_week and seconds > 0),
    'avg_seconds_per_active_student_week', (
      select coalesce(round(sum(seconds)::numeric / nullif(count(distinct user_id), 0)), 0)
      from public.activity_minutes where date >= v_week),
    'revenue_month_paise', (select coalesce(sum(total_paise), 0) from public.orders
                            where status = 'paid' and provider <> 'mock' and paid_at >= v_month),
    'test_revenue_month_paise', (select coalesce(sum(total_paise), 0) from public.orders
                                 where status = 'paid' and provider = 'mock' and paid_at >= v_month),
    'orders_month', (select count(*) from public.orders where status = 'paid' and paid_at >= v_month),
    'submissions_waiting', (select count(*) from public.external_submissions where status = 'submitted'),
    'leads_week', (select count(*) from public.leads where created_at >= (v_week::timestamp at time zone 'Asia/Kolkata')),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'students', coalesce(a.students, 0), 'seconds', coalesce(a.seconds, 0)) order by d.day), '[]'::jsonb)
      from generate_series(v_today - 29, v_today, interval '1 day') as d(day)
      left join (select date, count(distinct user_id) as students, sum(seconds) as seconds
                 from public.activity_minutes where date > v_today - 30 group by date) a on a.date = d.day::date
    ),
    'top_courses', (
      select coalesce(jsonb_agg(t order by t.enrolled desc, t.title), '[]'::jsonb) from (
        select c.id, c.title, c.slug,
               (select count(*) from public.enrollments e where e.course_id = c.id and e.status = 'active') as enrolled,
               (select count(*) from public.lesson_progress p where p.course_id = c.id and p.status = 'completed') as lessons_completed,
               (select coalesce(sum(seconds), 0) from public.activity_minutes m where m.course_id = c.id and m.date > v_today - 30) as seconds_30d
        from public.courses c where c.status = 'published'
        order by 4 desc, c.title limit 5
      ) t
    )
  ) into v;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin students table
-- ---------------------------------------------------------------------------
create or replace function public.admin_students(p_search text default null)
returns table (
  id uuid, full_name text, email text, class_level smallint, account_status public.account_status,
  courses integer, total_seconds bigint, external_seconds bigint, last_active timestamptz,
  lessons_done integer, lessons_total integer, completion_pct integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
  with s as (
    select p.id, p.full_name, p.email, p.class_level, p.account_status
    from public.profiles p
    where p.role = 'student'
      and (p_search is null or p.full_name ilike '%' || p_search || '%' or p.email ilike '%' || p_search || '%')
  ),
  enr as (
    select e.user_id, count(*)::int as courses,
           sum((select count(*) from public.lessons l where l.course_id = e.course_id and l.published_version_id is not null))::int as lessons_total
    from public.enrollments e where e.status = 'active' group by e.user_id
  )
  select s.id, s.full_name, s.email, s.class_level, s.account_status,
         coalesce(enr.courses, 0),
         coalesce((select sum(m.seconds) from public.activity_minutes m where m.user_id = s.id), 0)::bigint,
         coalesce((select sum(x.seconds) from public.external_task_minutes x where x.user_id = s.id), 0)::bigint,
         (select max(lp.last_activity_at) from public.lesson_progress lp where lp.user_id = s.id),
         coalesce((select count(*) from public.lesson_progress lp where lp.user_id = s.id and lp.status = 'completed'), 0)::int,
         coalesce(enr.lessons_total, 0),
         case when coalesce(enr.lessons_total, 0) = 0 then 0
              else least(100, round(100.0 * (select count(*) from public.lesson_progress lp join public.enrollments e2
                                                on e2.user_id = lp.user_id and e2.course_id = lp.course_id and e2.status = 'active'
                                              where lp.user_id = s.id and lp.status = 'completed') / enr.lessons_total))::int end
  from s left join enr on enr.user_id = s.id
  order by 9 desc nulls last, s.full_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Engagement: time per student / course / lesson in a date range
-- ---------------------------------------------------------------------------
create or replace function public.admin_engagement(p_from date, p_to date, p_group text)
returns table (key_id uuid, label text, detail text, students integer, active_seconds bigint, external_seconds bigint, lessons_completed integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_group not in ('student', 'course', 'lesson') then raise exception 'bad group' using errcode = '22023'; end if;
  if p_to < p_from or p_to - p_from > 366 then raise exception 'bad range' using errcode = '22023'; end if;

  return query
  with a as (
    select m.user_id, m.course_id, m.lesson_id, m.seconds, 0::bigint as ext
    from public.activity_minutes m where m.date between p_from and p_to
    union all
    select x.user_id, x.course_id, x.lesson_id, 0, x.seconds
    from public.external_task_minutes x where x.date between p_from and p_to
  ),
  done as (
    select lp.user_id, lp.course_id, lp.lesson_id from public.lesson_progress lp
    where lp.status = 'completed'
      and (lp.completed_at at time zone 'Asia/Kolkata')::date between p_from and p_to
  )
  select k.key_id, k.label, k.detail, k.students, k.active_seconds, k.external_seconds,
         (case p_group
            when 'student' then (select count(*) from done where done.user_id = k.key_id)
            when 'course' then (select count(*) from done where done.course_id = k.key_id)
            else (select count(*) from done where done.lesson_id = k.key_id) end)::int
  from (
    select case p_group when 'student' then a.user_id when 'course' then a.course_id else a.lesson_id end as key_id,
           max(case p_group
                 when 'student' then (select coalesce(p.full_name, p.email) from public.profiles p where p.id = a.user_id)
                 when 'course' then (select c.title from public.courses c where c.id = a.course_id)
                 else (select l.title from public.lessons l where l.id = a.lesson_id) end) as label,
           max(case p_group
                 when 'student' then (select 'Class ' || coalesce(p.class_level::text, '?') from public.profiles p where p.id = a.user_id)
                 when 'lesson' then (select c.title from public.courses c where c.id = a.course_id)
                 else null end) as detail,
           count(distinct a.user_id)::int as students,
           sum(a.seconds)::bigint as active_seconds,
           sum(a.ext)::bigint as external_seconds
    from a
    where p_group <> 'lesson' or a.lesson_id is not null
    group by 1
  ) k
  order by k.active_seconds desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gallery: approved + student opted in + a parent consented. First name only.
-- ---------------------------------------------------------------------------
create or replace function public.gallery_items(p_limit integer default 60)
returns table (id uuid, first_name text, class_level smallint, course_title text, lesson_title text, kind public.submission_kind, url text, has_image boolean, approved_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  -- Signed-in, active members only (never public).
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and (p.account_status = 'active' or p.role in ('admin', 'content_editor'))
  ) then
    raise exception 'members only' using errcode = '42501';
  end if;
  return query
  select s.id,
         split_part(btrim(coalesce(p.full_name, 'Student')), ' ', 1),
         p.class_level, c.title, l.title, s.kind,
         case when s.kind = 'url' then s.url end,
         s.kind = 'screenshot' and s.storage_path is not null,
         s.reviewed_at
  from public.external_submissions s
  join public.profiles p on p.id = s.user_id
  join public.courses c on c.id = s.course_id
  join public.lessons l on l.id = s.lesson_id
  where s.status = 'approved'
    and s.share_in_gallery
    and s.kind in ('url', 'screenshot')
    and exists (select 1 from public.parent_student_links k where k.student_id = s.user_id and k.status = 'active' and k.gallery_consent)
  order by s.reviewed_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_students(text) from public, anon;
revoke all on function public.admin_engagement(date, date, text) from public, anon;
revoke all on function public.gallery_items(integer) from public, anon;
grant execute on function public.admin_overview(), public.admin_students(text), public.admin_engagement(date, date, text), public.gallery_items(integer) to authenticated;
revoke all on function private.ist_now() from public;
grant execute on function private.ist_now() to authenticated, service_role;
