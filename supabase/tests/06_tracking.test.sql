\set QUIET on
create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated, service_role;
insert into ids values
  ('s', tests.create_user('s@example.com', '{"full_name":"S","class_level":"8","parent_phone":"98765 43210","parent_email":"p@example.com"}')),
  ('other', tests.create_user('o@example.com', '{"full_name":"O","class_level":"8","parent_phone":"98765 43210","parent_email":"q@example.com"}')),
  ('parent', tests.create_user('p@example.com', '{"signup_role":"parent","full_name":"P"}')),
  ('course', '00000000-0000-4000-8000-000000000001'),
  ('lesson', '00000000-0000-4000-8000-000000001001'),
  ('paid_lesson', '00000000-0000-4000-8000-000000002002');
update public.profiles set account_status = 'active' where id in ((select id from ids where name = 's'), (select id from ids where name = 'other'));
insert into public.enrollments (user_id, course_id, source) values ((select id from ids where name = 's'), (select id from ids where name = 'course'), 'free');
insert into public.parent_student_links (parent_id, student_id, status) values ((select id from ids where name = 'parent'), (select id from ids where name = 's'), 'active');

create temp table r (n int, credited int) on commit drop;
grant all on r to service_role;

set role service_role;
-- first beat: credits up to 30
insert into r values (1, public.record_heartbeat((select id from ids where name = 's'), (select id from ids where name = 'course'), (select id from ids where name = 'lesson'), 30));
-- a client claiming 500 s can't get more than 30
-- (simulate 40 s passing)
reset role;
update public.activity_state set last_beat_at = now() - interval '40 seconds' where user_id = (select id from ids where name = 's');
set role service_role;
insert into r values (2, public.record_heartbeat((select id from ids where name = 's'), (select id from ids where name = 'course'), (select id from ids where name = 'lesson'), 500));
-- immediate extra beat: ignored (25 s rule)
insert into r values (3, public.record_heartbeat((select id from ids where name = 's'), (select id from ids where name = 'course'), (select id from ids where name = 'lesson'), 30));
reset role;
update public.activity_state set last_beat_at = now() - interval '10 seconds' where user_id = (select id from ids where name = 's');
set role service_role;
-- flush 10 s after a beat: accepted, but only the 10 s that really passed
insert into r values (4, public.record_heartbeat((select id from ids where name = 's'), (select id from ids where name = 'course'), (select id from ids where name = 'lesson'), 30, true));
-- second flush straight away: nothing left to credit
insert into r values (5, public.record_heartbeat((select id from ids where name = 's'), (select id from ids where name = 'course'), (select id from ids where name = 'lesson'), 30, true));
-- no access: paid lesson not enrolled; other student not enrolled in the course
insert into r values (6, public.record_heartbeat((select id from ids where name = 's'), '00000000-0000-4000-8000-000000000002', (select id from ids where name = 'paid_lesson'), 30));
insert into r values (7, public.record_heartbeat((select id from ids where name = 'other'), (select id from ids where name = 'course'), null, 30));
-- lesson that doesn't belong to the course
insert into r values (8, public.record_heartbeat((select id from ids where name = 's'), (select id from ids where name = 'course'), (select id from ids where name = 'paid_lesson'), 30));
select public.record_external_away((select id from ids where name = 's'), (select id from ids where name = 'course'), (select id from ids where name = 'lesson'), 600);
select public.record_external_away((select id from ids where name = 's'), (select id from ids where name = 'course'), (select id from ids where name = 'lesson'), 99999);
reset role;

select tests.assert((select array_agg(credited order by n) from r) = '{30,30,0,10,0,0,0,0}', 'credits: ' || (select array_agg(credited order by n)::text from r));
select tests.assert(
  (select count(*) = 1 and sum(seconds) = 70 from public.activity_minutes where user_id = (select id from ids where name = 's')),
  'one aggregate row (no row per heartbeat) with 70 s');
select tests.assert(
  (select date = (now() at time zone 'Asia/Kolkata')::date from public.activity_minutes limit 1), 'dated in IST');
select tests.assert(
  (select seconds = 600 + 21600 from public.external_task_minutes), 'external time stored separately and capped per call');

-- direct calls are refused for users
select tests.login_as((select id from ids where name = 's'));
do $$ begin
  perform public.record_heartbeat(auth.uid(), '00000000-0000-4000-8000-000000000001', null, 30);
  raise exception 'students must not call record_heartbeat';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.activity_minutes (user_id, date, course_id, seconds) values (auth.uid(), current_date, '00000000-0000-4000-8000-000000000001', 9999);
  raise exception 'students must not write time';
exception when insufficient_privilege then null;
end $$;
select tests.assert((select active_seconds = 70 and estimated_external_seconds = 22200 from public.daily_activity), 'daily view for self');
select tests.assert((select active_seconds = 70 from public.weekly_activity), 'weekly view');
select tests.assert((select avg_seconds_per_student = 70 and students = 1 from public.lesson_time_stats), 'lesson averages');
select tests.assert((select count(*) = 1 from public.get_time_summary(auth.uid(), current_date - 7, current_date + 1)), 'summary RPC');
select tests.logout();

select tests.login_as((select id from ids where name = 'parent'));
select tests.assert((select count(*) = 1 from public.get_time_summary((select id from ids where name = 's'), current_date - 7, current_date + 1)), 'parent sees child time');
select tests.logout();
select tests.login_as((select id from ids where name = 'other'));
select tests.assert((select count(*) = 0 from public.daily_activity), 'views respect RLS (security_invoker)');
select tests.assert((select count(*) = 0 from public.get_time_summary((select id from ids where name = 's'), current_date - 7, current_date + 1)), 'no peeking at others');
select tests.logout();
select tests.login_anon();
do $$ begin
  perform 1 from public.daily_activity;
  raise exception 'anon must not read views';
exception when insufficient_privilege then null;
end $$;
select tests.logout();
