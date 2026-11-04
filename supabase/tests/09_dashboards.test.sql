\set QUIET on
create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated, service_role;
insert into ids values
  ('admin', tests.create_user('admin@example.com', '{}')),
  ('editor', tests.create_user('ed@example.com', '{}')),
  ('parent', tests.create_user('par@example.com', '{"signup_role":"parent","full_name":"Par"}')),
  ('asha', tests.create_user('asha@example.com', '{"full_name":"Asha Kapoor","class_level":"8","parent_email":"par@example.com"}')),
  ('ravi', tests.create_user('ravi@example.com', '{"full_name":"Ravi Shah","class_level":"7","parent_email":"x@example.com"}')),
  ('course', '00000000-0000-4000-8000-000000000002'),
  ('lesson', '00000000-0000-4000-8000-000000002006');
update public.profiles set role = 'admin', account_status = 'active' where id = (select id from ids where name = 'admin');
update public.profiles set role = 'content_editor', account_status = 'active' where id = (select id from ids where name = 'editor');
update public.profiles set account_status = 'active' where id in ((select id from ids where name = 'asha'), (select id from ids where name = 'ravi'));
insert into public.parent_student_links (parent_id, student_id, status) values ((select id from ids where name = 'parent'), (select id from ids where name = 'asha'), 'active');

insert into public.enrollments (user_id, course_id, source) select id, (select id from ids where name = 'course'), 'admin' from ids where name in ('asha', 'ravi');
insert into public.activity_minutes (user_id, date, course_id, lesson_id, seconds)
values ((select id from ids where name = 'asha'), private.ist_today(), (select id from ids where name = 'course'), (select id from ids where name = 'lesson'), 600),
       ((select id from ids where name = 'ravi'), private.ist_today() - 1, (select id from ids where name = 'course'), null, 120);
insert into public.lesson_progress (user_id, course_id, lesson_id, lesson_version_id, status, completed_at)
select (select id from ids where name = 'asha'), (select id from ids where name = 'course'), l.id, l.published_version_id, 'completed', now()
from public.lessons l where l.id = (select id from ids where name = 'lesson');
insert into public.orders (buyer_id, student_id, course_id, list_price_paise, total_paise, provider, status, paid_at)
values ((select id from ids where name = 'parent'), (select id from ids where name = 'asha'), (select id from ids where name = 'course'), 49900, 49900, 'razorpay', 'paid', now()),
       ((select id from ids where name = 'parent'), (select id from ids where name = 'ravi'), (select id from ids where name = 'course'), 49900, 49900, 'mock', 'paid', now());

-- approved screenshot + url submissions
insert into public.external_submissions (user_id, course_id, lesson_id, lesson_version_id, block_id, kind, url, status, share_in_gallery, reviewed_at)
select (select id from ids where name = 'asha'), (select id from ids where name = 'course'), l.id, l.published_version_id, 'task', 'url', 'https://asha.netlify.app', 'approved', true, now()
from public.lessons l where l.id = (select id from ids where name = 'lesson');
insert into public.external_submissions (user_id, course_id, lesson_id, lesson_version_id, block_id, kind, url, status, share_in_gallery, reviewed_at)
select (select id from ids where name = 'ravi'), (select id from ids where name = 'course'), l.id, l.published_version_id, 'task', 'url', 'https://ravi.netlify.app', 'approved', true, now()
from public.lessons l where l.id = (select id from ids where name = 'lesson');

-- --- admin overview -----------------------------------------------------------
select tests.login_as((select id from ids where name = 'admin'));
select tests.assert((select (o ->> 'active_today')::int = 1 and (o ->> 'revenue_month_paise')::int = 49900 and (o ->> 'test_revenue_month_paise')::int = 49900
                       and jsonb_array_length(o -> 'daily') = 30 and (o -> 'top_courses' -> 0 ->> 'enrolled')::int >= 2
                     from (select public.admin_overview() o) x), 'overview: active today, real vs test revenue, 30 days, top courses');
select tests.assert((select count(*) = 2 from public.admin_students(null)), 'students list');
select tests.assert((select total_seconds = 600 and lessons_done = 1 and lessons_total = 6 and completion_pct = 17 from public.admin_students('asha')), 'student row: time + completion %');
select tests.assert((select count(*) = 1 from public.admin_students('Ravi')), 'search by name');
select tests.assert((select sum(active_seconds) = 720 and count(*) = 2 from public.admin_engagement(private.ist_today() - 7, private.ist_today(), 'student')), 'engagement by student');
select tests.assert((select count(*) = 1 and max(lessons_completed) = 1 from public.admin_engagement(private.ist_today() - 7, private.ist_today(), 'lesson')), 'engagement by lesson (course-level time excluded)');
do $$ begin
  perform public.admin_engagement(current_date, current_date - 1, 'course');
  raise exception 'bad range must fail';
exception when sqlstate '22023' then null;
end $$;
select tests.logout();

-- --- non-admins can't run reports ----------------------------------------------------
select tests.login_as((select id from ids where name = 'editor'));
do $$ begin
  perform public.admin_overview();
  raise exception 'editors must not see the overview (revenue)';
exception when insufficient_privilege then null;
end $$;
select tests.logout();
select tests.login_as((select id from ids where name = 'parent'));
do $$ begin
  perform * from public.admin_students(null);
  raise exception 'parents must not list students';
exception when insufficient_privilege then null;
end $$;

-- --- gallery: needs parent consent; first names only ----------------------------------
select tests.assert((select count(*) = 0 from public.gallery_items()), 'nothing without parent consent');
select tests.logout();
update public.parent_student_links set gallery_consent = true where student_id = (select id from ids where name = 'asha');
select tests.login_as((select id from ids where name = 'ravi'));
select tests.assert((select count(*) = 1 and min(first_name) = 'Asha' from public.gallery_items()), 'consented project visible, first name only');
select tests.assert((select bool_and(url is not null) from public.gallery_items()), 'url kept for link projects');
select tests.logout();
update public.profiles set account_status = 'pending_consent' where id = (select id from ids where name = 'ravi');
select tests.login_as((select id from ids where name = 'ravi'));
do $$ begin
  perform * from public.gallery_items();
  raise exception 'gallery is for active members only';
exception when insufficient_privilege then null;
end $$;
select tests.logout();
select tests.login_anon();
do $$ begin
  perform * from public.gallery_items();
  raise exception 'gallery is not public';
exception when insufficient_privilege then null;
end $$;
select tests.logout();
