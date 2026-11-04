\set QUIET on
create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to anon, authenticated;
insert into ids values
  ('g_parent', tests.create_user('gp@example.com', '{}')),
  ('student', tests.create_user('s@example.com', '{"full_name":"S","class_level":"7","parent_phone":"98765 43210","parent_email":"p@example.com"}'));

-- consent: only the server (service role) can grant it -------------------------
select tests.login_as((select id from ids where name = 'student'));
do $$ begin
  perform public.grant_consent((select id from public.consents limit 1), 'admin', true, true, 'x');
  raise exception 'students must not grant their own consent';
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
select public.grant_consent((select id from public.consents where student_id = (select id from ids where name = 'student')), 'whatsapp_link', true, false, '2026-11');
select tests.assert(
  (select p.account_status = 'active' and p.parent_whatsapp_opt_in and not p.gallery_consent and c.status = 'granted' and c.method = 'whatsapp_link' and c.token_hash is null
     from public.profiles p join public.consents c on c.student_id = p.id where p.id = (select id from ids where name = 'student')),
  'grant_consent activates the account and records the parent''s choices');
update public.rate_limits set window_start = now() - interval '2 minutes' where key = 'otp:1.2.3.4';
set role service_role;
select tests.assert(public.consume_rate_limit('otp:1.2.3.4', 2, 60), 'window resets');
reset role;
