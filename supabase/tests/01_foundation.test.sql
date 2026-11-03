-- Foundation: signup trigger, role clamping, profile/link/consent RLS, admin RPCs.
\set QUIET on

-- --- fixtures (as superuser) ------------------------------------------------
create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;

insert into ids values
  ('student', tests.create_user('Stu@Example.com', '{"full_name":"Asha","class_level":"7","parent_email":"Parent@Example.com","signup_role":"student"}')),
  ('student2', tests.create_user('stu2@example.com', '{"full_name":"Ravi","class_level":"8","parent_email":"other@example.com"}')),
  ('google_student', tests.create_user('g@example.com', '{}')),
  ('sneaky', tests.create_user('sneaky@example.com', '{"signup_role":"admin","full_name":"X"}')),
  ('parent', tests.create_user('parent@example.com', '{"signup_role":"parent","full_name":"Meera"}')),
  ('admin', tests.create_user('admin@example.com', '{"signup_role":"parent"}')),
  ('editor', tests.create_user('editor@example.com', '{}'));

update public.profiles set role = 'admin', account_status = 'active' where id = (select id from ids where name = 'admin');
update public.profiles set role = 'content_editor', account_status = 'active' where id = (select id from ids where name = 'editor');
insert into public.parent_student_links (parent_id, student_id, status)
values ((select id from ids where name = 'parent'), (select id from ids where name = 'student'), 'active');

-- --- signup trigger ---------------------------------------------------------
select tests.assert(
  (select role = 'student' and account_status = 'pending_consent' and email = 'stu@example.com'
          and parent_email = 'parent@example.com' and class_level = 7
     from public.profiles where id = (select id from ids where name = 'student')),
  'student signup creates pending_consent profile with normalised emails');

select tests.assert(
  (select count(*) = 1 from public.consents
    where student_id = (select id from ids where name = 'student') and status = 'pending'),
  'student signup creates a pending consent');

select tests.assert(
  (select role = 'student' from public.profiles where id = (select id from ids where name = 'sneaky')),
  'signup metadata cannot grant admin');

select tests.assert(
  (select account_status = 'pending_profile' from public.profiles where id = (select id from ids where name = 'google_student')),
  'signup without details is pending_profile');

select tests.assert(
  (select role = 'parent' and account_status = 'active' from public.profiles where id = (select id from ids where name = 'parent')),
  'parent signup is active');

-- --- anon sees nothing --------------------------------------------------------
select tests.login_anon();
do $$ begin
  perform 1 from public.profiles;
  raise exception 'anon should not be able to select profiles';
exception when insufficient_privilege then null;
end $$;
select tests.logout();

-- --- student ----------------------------------------------------------------
select tests.login_as((select id from ids where name = 'student'));
select tests.assert((select count(*) = 1 from public.profiles), 'student sees only own profile');
select tests.assert((select count(*) = 1 from public.consents), 'student sees own consent');
select tests.assert((select count(*) = 0 from public.settings), 'student cannot read settings');
select tests.assert((select count(*) = 0 from public.audit_log), 'student cannot read audit log');

update public.profiles set full_name = 'Asha K' where id = auth.uid();
select tests.assert((select full_name = 'Asha K' from public.profiles where id = auth.uid()), 'student can rename self');

do $$ begin
  update public.profiles set role = 'admin' where id = auth.uid();
  raise exception 'student must not be able to change role';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  update public.profiles set account_status = 'active' where id = auth.uid();
  raise exception 'student must not be able to self-activate';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  update public.profiles set parent_email = 'me2@example.com' where id = auth.uid();
  raise exception 'student must not be able to change parent email directly';
exception when insufficient_privilege then null;
end $$;

-- updating someone else's row silently affects 0 rows
update public.profiles set full_name = 'hacked' where id = (select id from ids where name = 'student2');

do $$ begin
  perform public.admin_set_role((select id from ids where name = 'student'), 'admin');
  raise exception 'student must not call admin_set_role';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  insert into public.parent_student_links (parent_id, student_id)
  values (auth.uid(), (select id from ids where name = 'student2'));
  raise exception 'student must not insert links';
exception when insufficient_privilege then null;
end $$;
select tests.logout();

select tests.assert(
  (select full_name = 'Ravi' from public.profiles where id = (select id from ids where name = 'student2')),
  'cross-user update had no effect');

-- --- parent -----------------------------------------------------------------
select tests.login_as((select id from ids where name = 'parent'));
select tests.assert((select count(*) = 2 from public.profiles), 'parent sees self + linked child');
select tests.assert(
  (select count(*) = 0 from public.profiles where id = (select id from ids where name = 'student2')),
  'parent cannot see unlinked student');
select tests.assert((select count(*) = 1 from public.parent_student_links), 'parent sees own link');
select tests.logout();

-- --- content editor ---------------------------------------------------------
select tests.login_as((select id from ids where name = 'editor'));
select tests.assert((select count(*) = 1 from public.profiles), 'editor sees only own profile');
select tests.assert((select count(*) = 0 from public.settings), 'editor cannot read settings');
select tests.logout();

-- --- complete_student_profile ----------------------------------------------
select tests.login_as((select id from ids where name = 'google_student'));
do $$ begin
  perform public.complete_student_profile('G', 7::smallint, 'g@example.com');
  raise exception 'own email must be rejected as parent email';
exception when sqlstate '22023' then null;
end $$;
select public.complete_student_profile('Gita', 8::smallint, 'GParent@example.com');
select tests.assert(
  (select account_status = 'pending_consent' and parent_email = 'gparent@example.com' from public.profiles where id = auth.uid()),
  'complete_student_profile moves to pending_consent');
do $$ begin
  perform public.complete_student_profile('Gita', 8::smallint, 'x@example.com');
  raise exception 'profile can only be completed once';
exception when insufficient_privilege then null;
end $$;
select tests.logout();

-- --- admin ------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'admin'));
select tests.assert((select count(*) = 7 from public.profiles), 'admin sees all profiles');
select tests.assert((select count(*) >= 3 from public.settings), 'admin reads settings');

select public.admin_set_role((select id from ids where name = 'student2'), 'content_editor');
select tests.assert(
  (select role = 'content_editor' from public.profiles where id = (select id from ids where name = 'student2')),
  'admin_set_role changes role');
select tests.assert(
  (select count(*) = 1 from public.audit_log where action = 'user.role_changed'),
  'admin_set_role writes audit log');

do $$ begin
  perform public.admin_set_role(auth.uid(), 'student');
  raise exception 'admin must not demote self';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  delete from public.audit_log;
  raise exception 'audit log must be append-only';
exception when insufficient_privilege then null;
end $$;

update public.settings set value = '"Hub"', updated_by = auth.uid() where key = 'platform.name';
select tests.assert((select value = '"Hub"' from public.settings where key = 'platform.name'), 'admin updates settings');
select tests.logout();
