\set QUIET on
create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;
insert into ids values
  ('g_parent', tests.create_user('gp@example.com', '{}')),
  ('student', tests.create_user('s@example.com', '{"full_name":"S","class_level":"7","parent_email":"p@example.com"}'));

-- complete_parent_profile ----------------------------------------------------
select tests.login_as((select id from ids where name = 'g_parent'));
select public.complete_parent_profile('Priya');
select tests.assert(
  (select role = 'parent' and account_status = 'active' from public.profiles where id = auth.uid()),
  'pending student can become parent');
do $$ begin
  perform public.complete_parent_profile('Again');
  raise exception 'second call must fail';
exception when insufficient_privilege then null;
end $$;
select tests.logout();

select tests.login_as((select id from ids where name = 'student'));
do $$ begin
  perform public.complete_parent_profile('Sneaky');
  raise exception 'a student awaiting consent must not switch to parent (consent bypass)';
exception when insufficient_privilege then null;
end $$;

-- rate limiter is service-role only ---------------------------------------------
do $$ begin
  perform public.consume_rate_limit('x', 1, 60);
  raise exception 'authenticated must not call consume_rate_limit';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform 1 from public.rate_limits;
  raise exception 'authenticated must not read rate_limits';
exception when insufficient_privilege then null;
end $$;
select tests.logout();

set role service_role;
select tests.assert(public.consume_rate_limit('otp:1.2.3.4', 2, 60), 'hit 1 allowed');
select tests.assert(public.consume_rate_limit('otp:1.2.3.4', 2, 60), 'hit 2 allowed');
select tests.assert(not public.consume_rate_limit('otp:1.2.3.4', 2, 60), 'hit 3 blocked');
select tests.assert(public.consume_rate_limit('otp:5.6.7.8', 2, 60), 'other key independent');
reset role;
update public.rate_limits set window_start = now() - interval '2 minutes' where key = 'otp:1.2.3.4';
set role service_role;
select tests.assert(public.consume_rate_limit('otp:1.2.3.4', 2, 60), 'window resets');
reset role;
