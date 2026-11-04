\set QUIET on
create temp table ids (name text primary key, id uuid) on commit drop;
grant select on ids to authenticated;
insert into ids values
  ('p', tests.create_user('ad-parent@example.com', '{"signup_role":"parent","full_name":"P","acquisition":{"utm_source":"google","utm_medium":"cpc","utm_campaign":"ai-for-kids","gclid":"SECRET","evil":"x"}}')),
  ('s', tests.create_user('plain@example.com', '{"full_name":"S","class_level":"7","parent_phone":"98765 43210","parent_email":"x@example.com","acquisition":"not-an-object"}')),
  ('admin', tests.create_user('a@example.com', '{}'));
update public.profiles set role = 'admin' where id = (select id from ids where name = 'admin');

select tests.assert(
  (select acquisition = '{"utm_source":"google","utm_medium":"cpc","utm_campaign":"ai-for-kids"}'::jsonb from public.profiles where id = (select id from ids where name = 'p')),
  'only source/medium/campaign are kept (no click ids, no extra keys)');
select tests.assert((select acquisition is null from public.profiles where id = (select id from ids where name = 's')), 'junk attribution ignored');
select tests.assert((select account_status = 'pending_consent' from public.profiles where id = (select id from ids where name = 's')), 'signup trigger still works');

insert into public.leads (parent_email, child_class, marketing_consent, utm_campaign) values ('lead@example.com', 7, true, 'summer');
select tests.login_as((select id from ids where name = 's'));
select tests.assert((select count(*) = 0 from public.leads), 'students cannot read leads');
do $$ begin
  insert into public.leads (parent_email) values ('spam@example.com');
  raise exception 'clients must not insert leads directly';
exception when insufficient_privilege then null;
end $$;
select tests.logout();
select tests.login_as((select id from ids where name = 'admin'));
select tests.assert((select count(*) = 1 from public.leads), 'admin reads leads');
select tests.logout();
