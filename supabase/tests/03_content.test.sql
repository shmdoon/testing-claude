\set QUIET on
create temp table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to anon, authenticated;

insert into ids values
  ('admin', tests.create_user('admin@example.com', '{}')),
  ('editor', tests.create_user('editor@example.com', '{}')),
  ('student', tests.create_user('stu@example.com', '{"full_name":"S","class_level":"7","parent_email":"p@example.com"}'));
update public.profiles set role = 'admin', account_status = 'active' where id = (select id from ids where name = 'admin');
update public.profiles set role = 'content_editor', account_status = 'active' where id = (select id from ids where name = 'editor');

-- --- editor builds a course ---------------------------------------------------
select tests.login_as((select id from ids where name = 'editor'));
insert into public.courses (slug, title, course_type, is_free, created_by)
values ('ai-basics', 'AI Basics', 'mini', true, auth.uid());
insert into ids select 'course', id from public.courses where slug = 'ai-basics';
insert into public.modules (course_id, title, position) values ((select id from ids where name = 'course'), 'M1', 1);
insert into ids select 'module', id from public.modules where title = 'M1';
insert into public.lessons (module_id, slug, title, position, is_preview)
values ((select id from ids where name = 'module'), 'l1', 'Lesson 1', 1, true),
       ((select id from ids where name = 'module'), 'l2', 'Lesson 2', 2, false);
insert into ids select 'l1', id from public.lessons where slug = 'l1';
insert into ids select 'l2', id from public.lessons where slug = 'l2';

select tests.assert(
  (select course_id = (select id from ids where name = 'course') from public.lessons where slug = 'l1'),
  'lesson.course_id derived from module');

do $$ begin
  update public.courses set status = 'published' where slug = 'ai-basics';
  raise exception 'status must only change through set_course_status';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  perform public.set_course_status((select id from ids where name = 'course'), 'published');
  raise exception 'cannot publish a course without published lessons';
exception when sqlstate '22023' then null;
end $$;

select public.save_lesson_draft((select id from ids where name = 'l1'), '[{"id":"a","type":"rich_text","phase":"module","markdown":"v1"}]');
select public.save_lesson_draft((select id from ids where name = 'l1'), '[{"id":"a","type":"rich_text","phase":"module","markdown":"v1b"}]');
select tests.assert(
  (select count(*) = 1 from public.lesson_versions where lesson_id = (select id from ids where name = 'l1')),
  'saving twice keeps a single draft');

select public.publish_lesson((select id from ids where name = 'l1'));
select public.save_lesson_draft((select id from ids where name = 'l1'), '[{"id":"a","type":"rich_text","phase":"module","markdown":"v2"}]');
select public.publish_lesson((select id from ids where name = 'l1'));
select public.save_lesson_draft((select id from ids where name = 'l2'), '[{"id":"b","type":"rich_text","phase":"module","markdown":"paid"}]');
select public.publish_lesson((select id from ids where name = 'l2'));

select tests.assert(
  (select array_agg(version order by version) = '{1,2}' from public.lesson_versions
    where lesson_id = (select id from ids where name = 'l1') and status = 'published'),
  'publishing creates versions 1 and 2');
select tests.assert(
  (select v.blocks -> 0 ->> 'markdown' = 'v2' from public.lessons l join public.lesson_versions v on v.id = l.published_version_id
    where l.id = (select id from ids where name = 'l1')),
  'lesson points at latest version');

do $$ begin
  update public.lesson_versions set blocks = '[]' where status = 'published';
  raise exception 'direct writes to versions must be refused';
exception when insufficient_privilege then null;
end $$;

select public.set_course_status((select id from ids where name = 'course'), 'published');

-- reorder
select public.reorder_lessons((select id from ids where name = 'module'),
  array[(select id from ids where name = 'l2'), (select id from ids where name = 'l1')]);
select tests.assert((select position = 1 from public.lessons where slug = 'l2'), 'reorder_lessons');
do $$ begin
  perform public.reorder_lessons((select id from ids where name = 'module'), array[(select id from ids where name = 'l2')]);
  raise exception 'partial reorder must fail';
exception when sqlstate '22023' then null;
end $$;

-- editors cannot manage the tool registry
do $$ begin
  insert into public.external_tools (slug, name, base_url) values ('x', 'X', 'https://x.com');
  raise exception 'editor must not insert tools';
exception when insufficient_privilege then null;
end $$;
select tests.logout();

-- immutability holds even for the table owner path (trigger)
do $$ begin
  update public.lesson_versions set blocks = '[]' where status = 'published';
  raise exception 'published versions must be immutable';
exception when insufficient_privilege then null;
end $$;

-- --- anon ---------------------------------------------------------------------
select tests.login_anon();
select tests.assert((select count(*) = 1 from public.courses where slug = 'ai-basics'), 'anon sees published course');
select tests.assert((select count(*) = 2 from public.lessons where course_id = (select id from ids where name = 'course')), 'anon sees published lesson list');
select tests.assert(
  (select count(*) = 1 from public.lesson_versions where lesson_id in (select id from ids where name in ('l1', 'l2'))),
  'anon reads only the current published version of the preview lesson');
select tests.assert(
  (select blocks -> 0 ->> 'markdown' = 'v2' from public.lesson_versions where lesson_id = (select id from ids where name = 'l1')),
  'anon preview is the latest version');
select tests.logout();

-- --- student (not enrolled) ----------------------------------------------------
select tests.login_as((select id from ids where name = 'student'));
select tests.assert((select count(*) = 1 from public.lesson_versions where lesson_id in (select id from ids where name in ('l1', 'l2'))), 'student sees preview content only');
do $$ begin
  perform public.save_lesson_draft((select id from ids where name = 'l1'), '[]');
  raise exception 'student must not save drafts';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.courses (slug, title, is_free, created_by) values ('evil', 'Evil', true, auth.uid());
  raise exception 'student must not create courses';
exception when insufficient_privilege then null;
end $$;
select tests.logout();

-- unpublish hides everything again
select tests.login_as((select id from ids where name = 'editor'));
select public.set_course_status((select id from ids where name = 'course'), 'draft');
select tests.logout();
select tests.login_anon();
select tests.assert((select count(*) = 0 from public.courses where slug = 'ai-basics'), 'draft course hidden');
select tests.assert((select count(*) = 0 from public.lessons where course_id = (select id from ids where name = 'course')), 'draft course lessons hidden');
select tests.assert((select count(*) = 0 from public.lesson_versions where lesson_id in (select id from ids where name in ('l1', 'l2'))), 'draft course content hidden');
select tests.logout();

-- --- admin: tools + delete cascades ----------------------------------------------
select tests.login_as((select id from ids where name = 'admin'));
insert into public.external_tools (slug, name, base_url, submission_domains, min_age)
values ('test-tool', 'Test', 'https://example.com', '{*.example.app}', 13);
update public.external_tools set enabled = false where slug = 'test-tool';
delete from public.courses where slug = 'ai-basics';
select tests.assert((select count(*) = 0 from public.lessons where course_id = (select id from ids where name = 'course')), 'course delete cascades');
select tests.logout();
select tests.assert((select count(*) = 0 from public.lesson_versions where lesson_id in (select id from ids where name in ('l1', 'l2'))), 'versions removed with their course');
select tests.assert(
  (select count(*) = 3 from public.audit_log where action in ('lesson.published')),
  'publishing is audited');

-- course_id passed by the client is overwritten from the module
select tests.login_as((select id from ids where name = 'editor'));
insert into public.courses (slug, title, is_free, created_by) values ('other', 'Other', true, auth.uid());
insert into public.modules (course_id, title) select id, 'OM' from public.courses where slug = 'other';
insert into public.lessons (module_id, course_id, slug, title)
select m.id, '00000000-0000-4000-8000-000000000002', 'spoof', 'Spoof' from public.modules m where m.title = 'OM';
select tests.assert(
  (select l.course_id = c.id from public.lessons l join public.courses c on c.slug = 'other' where l.slug = 'spoof'),
  'lesson course_id cannot be spoofed');
select tests.logout();
