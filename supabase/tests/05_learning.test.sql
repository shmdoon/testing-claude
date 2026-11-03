\set QUIET on
create temp table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to anon, authenticated, service_role;

insert into ids values
  ('active', tests.create_user('active@example.com', '{"full_name":"A","class_level":"8","parent_email":"pa@example.com"}')),
  ('pending', tests.create_user('pending@example.com', '{"full_name":"P","class_level":"7","parent_email":"pp@example.com"}')),
  ('parent', tests.create_user('pa@example.com', '{"signup_role":"parent","full_name":"PA"}')),
  ('editor', tests.create_user('ed@example.com', '{}')),
  -- seed: AI Explorers (paid) lesson 6 = external task; lesson 1 = preview
  ('course', '00000000-0000-4000-8000-000000000002'),
  ('l_preview', '00000000-0000-4000-8000-000000002001'),
  ('l_paid', '00000000-0000-4000-8000-000000002002'),
  ('l_ext', '00000000-0000-4000-8000-000000002006');
update public.profiles set account_status = 'active' where id = (select id from ids where name = 'active');
update public.profiles set role = 'content_editor', account_status = 'active' where id = (select id from ids where name = 'editor');
insert into public.parent_student_links (parent_id, student_id, status)
values ((select id from ids where name = 'parent'), (select id from ids where name = 'active'), 'active');

-- --- access helper ------------------------------------------------------------
select tests.assert(private.can_access_lesson((select id from ids where name = 'active'), (select id from ids where name = 'l_preview')), 'active student can open preview lesson');
select tests.assert(not private.can_access_lesson((select id from ids where name = 'active'), (select id from ids where name = 'l_paid')), 'not enrolled → no paid lesson');
select tests.assert(not private.can_access_lesson((select id from ids where name = 'pending'), (select id from ids where name = 'l_preview')), 'pending-consent student cannot open lessons');
select tests.assert(private.can_access_lesson((select id from ids where name = 'editor'), (select id from ids where name = 'l_paid')), 'staff can open any lesson');

-- --- students cannot write learning data directly ------------------------------
select tests.login_as((select id from ids where name = 'active'));
do $$ begin
  insert into public.enrollments (user_id, course_id, source) values (auth.uid(), (select id from ids where name = 'course'), 'free');
  raise exception 'students must not self-enrol';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.block_responses (user_id, lesson_id, lesson_version_id, block_id, block_type, score, completed)
  values (auth.uid(), (select id from ids where name = 'l_preview'), '00000000-0000-4000-8000-000000006001', 'match', 'match_pairs', 100, true);
  raise exception 'students must not write scores';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.recompute_lesson_progress(auth.uid(), (select id from ids where name = 'l_preview'));
  raise exception 'students must not call recompute';
exception when insufficient_privilege then null;
end $$;
select tests.assert((select count(*) = 0 from public.lesson_versions where lesson_id = (select id from ids where name = 'l_paid')), 'paid content hidden before enrolment');
select tests.logout();

-- --- enrol (server path = service role) ---------------------------------------------
set role service_role;
insert into public.enrollments (user_id, course_id, source)
select id, (select id from ids where name = 'course'), 'admin' from ids where name in ('active', 'pending');
reset role;

select tests.login_as((select id from ids where name = 'active'));
select tests.assert((select count(*) = 1 from public.lesson_versions where lesson_id = (select id from ids where name = 'l_paid')), 'enrolled active student reads paid content');
select tests.logout();
select tests.login_as((select id from ids where name = 'pending'));
select tests.assert((select count(*) = 0 from public.lesson_versions where lesson_id = (select id from ids where name = 'l_paid')), 'enrolled but pending-consent student cannot read content');
select tests.logout();

-- --- version pinning ------------------------------------------------------------------
set role service_role;
insert into public.lesson_progress (user_id, course_id, lesson_id, lesson_version_id)
select (select id from ids where name = 'active'), (select id from ids where name = 'course'), l.id, l.published_version_id
from public.lessons l where l.id in ((select id from ids where name = 'l_paid'), (select id from ids where name = 'l_ext'));
reset role;
select tests.login_as((select id from ids where name = 'editor'));
select public.save_lesson_draft((select id from ids where name = 'l_paid'), '[{"id":"x","type":"rich_text","phase":"module","markdown":"v2"}]');
select public.publish_lesson((select id from ids where name = 'l_paid'));
select tests.logout();
select tests.login_as((select id from ids where name = 'active'));
select tests.assert((select count(*) = 2 from public.lesson_versions where lesson_id = (select id from ids where name = 'l_paid')),
  'student keeps access to the version they started plus the new one');
select tests.logout();

-- --- completion ---------------------------------------------------------------------
-- l_ext blocks: external_task "task", reflection "notice", quiz "check" (+ content)
set role service_role;
insert into public.block_responses (user_id, lesson_id, lesson_version_id, block_id, block_type, completed)
select (select id from ids where name = 'active'), (select id from ids where name = 'l_ext'), l.published_version_id, b, t, true
from public.lessons l, (values ('notice', 'reflection_prompt'), ('check', 'quiz')) v(b, t)
where l.id = (select id from ids where name = 'l_ext');
select tests.assert(public.recompute_lesson_progress((select id from ids where name = 'active'), (select id from ids where name = 'l_ext')) = 'in_progress', 'missing external task → in progress');

insert into public.external_submissions (user_id, course_id, lesson_id, lesson_version_id, block_id, kind, url)
select (select id from ids where name = 'active'), (select id from ids where name = 'course'), l.id, l.published_version_id, 'task', 'url', 'https://asha.netlify.app'
from public.lessons l where l.id = (select id from ids where name = 'l_ext');
insert into ids select 'sub', id from public.external_submissions limit 1;
select tests.assert(public.recompute_lesson_progress((select id from ids where name = 'active'), (select id from ids where name = 'l_ext')) = 'awaiting_review', 'pending submission → awaiting review');
reset role;

-- review
select tests.login_as((select id from ids where name = 'active'));
do $$ begin
  perform public.review_submission((select id from ids where name = 'sub'), 'approved', null);
  raise exception 'students must not review';
exception when insufficient_privilege then null;
end $$;
select tests.logout();

select tests.login_as((select id from ids where name = 'editor'));
do $$ begin
  perform public.review_submission((select id from ids where name = 'sub'), 'needs_revision', '  ');
  raise exception 'revision needs feedback';
exception when sqlstate '22023' then null;
end $$;
select tests.assert(public.review_submission((select id from ids where name = 'sub'), 'needs_revision', 'Add a title') = 'in_progress', 'needs revision → back to in progress');
select tests.assert(public.review_submission((select id from ids where name = 'sub'), 'approved', 'Great!') = 'completed', 'approval completes the lesson');
select tests.assert(public.review_submission((select id from ids where name = 'sub'), 'approved', 'Still great') = 'completed', 'idempotent');
select tests.logout();

select tests.assert(
  (select count(*) = 1 from public.learning_events where event_type = 'lesson_completed' and lesson_id = (select id from ids where name = 'l_ext')),
  'lesson_completed logged exactly once');
select tests.assert(
  (select status = 'completed' and completed_at is not null and current_phase = 'done' from public.lesson_progress
    where lesson_id = (select id from ids where name = 'l_ext')),
  'progress row completed');

-- --- readers ---------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'parent'));
select tests.assert((select count(*) = 2 from public.lesson_progress), 'parent reads linked child progress');
select tests.assert((select count(*) = 1 from public.external_submissions), 'parent reads child submissions');
select tests.logout();
select tests.login_as((select id from ids where name = 'pending'));
select tests.assert((select count(*) = 0 from public.lesson_progress), 'other students see nothing');
select tests.logout();
select tests.login_as((select id from ids where name = 'editor'));
select tests.assert((select count(*) = 1 from public.external_submissions), 'staff read submissions for review');
select tests.assert((select count(*) = 0 from public.lesson_progress), 'content editors do not read progress');
select tests.logout();
