\set QUIET on
create temp table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to authenticated, service_role;
insert into ids values
  ('kid', tests.create_user('kid@example.com', '{"full_name":"Asha Rao","class_level":"8","parent_phone":"98765 43210","parent_name":"Meera Rao","parent_email":"meera@example.com","parent_whatsapp_opt_in":true}')),
  ('free', tests.create_user('free@example.com', '{"full_name":"Ravi","class_level":"7","parent_phone":"9123456789"}')),
  ('admin', tests.create_user('a@example.com', '{}')),
  ('course', '00000000-0000-4000-8000-000000000002');
update public.profiles set role = 'admin', account_status = 'active' where id = (select id from ids where name = 'admin');
update public.profiles set account_status = 'active' where id in (select id from ids where name in ('kid', 'free'));

-- Paid order + learning data for kid
insert into public.orders (buyer_id, student_id, course_id, list_price_paise, total_paise, provider, provider_order_id, payer_name, payer_phone)
select (select id from ids where name = 'kid'), (select id from ids where name = 'kid'), (select id from ids where name = 'course'), 49900, 49900, 'razorpay', 'order_dr_1', 'Meera Rao', '+919876543210';
insert into ids select 'inv', public.fulfill_order((select id from public.orders where provider_order_id = 'order_dr_1'), 'pay_dr_1', 49900, 'upi');
insert into public.learning_events (user_id, event_type) values ((select id from ids where name = 'kid'), 'lesson_started');
insert into public.whatsapp_messages (student_id, to_phone, template, body, status)
values ((select id from ids where name = 'kid'), '+919876543210', 'invoice_ready', 'Hi', 'manual');
update public.consents set status = 'granted', granted_at = now(), method = 'whatsapp_link', policy_version = 'v1'
 where student_id = (select id from ids where name = 'kid');

insert into public.deletion_requests (student_id, subject_id, source, requested_by)
select id, id, 'student', id from ids where name = 'kid';
do $$ begin
  insert into public.deletion_requests (student_id, subject_id, source) select id, id, 'student' from ids where name = 'kid';
  raise exception 'only one pending request per student';
exception when unique_violation then null;
end $$;

-- --- RLS ------------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'kid'));
select tests.assert((select count(*) = 1 from public.deletion_requests), 'student sees own request');
do $$ begin
  insert into public.deletion_requests (student_id, subject_id, source) values (auth.uid(), auth.uid(), 'student');
  raise exception 'requests are created by the server only';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.erase_student(auth.uid());
  raise exception 'students cannot call erase_student';
exception when insufficient_privilege then null;
end $$;
select tests.logout();
select tests.login_as((select id from ids where name = 'free'));
select tests.assert((select count(*) = 0 from public.deletion_requests), 'no one else''s requests');
select tests.logout();
select tests.login_as((select id from ids where name = 'admin'));
select tests.assert((select count(*) = 1 from public.deletion_requests), 'admin sees the queue');
do $$ begin
  perform public.erase_student((select id from ids where name = 'kid'));
  raise exception 'admins go through the server, not the RPC';
exception when insufficient_privilege then null;
end $$;
select tests.logout();

-- --- Erasure (service role) -------------------------------------------------------
set role service_role;
create temp table outcome on commit drop as select public.erase_student((select id from ids where name = 'kid')) as o;
reset role;

select tests.assert((select (o ->> 'has_orders')::boolean from outcome), 'reports that orders exist (account must be anonymised, not deleted)');
select tests.assert((select full_name is null and class_level is null and parent_phone is null and parent_email is null and parent_name is null
                     and not parent_whatsapp_opt_in and account_status = 'deleted'
                     from public.profiles where id = (select id from ids where name = 'kid')), 'profile anonymised');
select tests.assert((select count(*) = 0 from public.learning_events where user_id = (select id from ids where name = 'kid')), 'learning data deleted');
select tests.assert((select count(*) = 0 from public.enrollments where user_id = (select id from ids where name = 'kid')), 'access removed');
select tests.assert((select count(*) = 0 from public.whatsapp_messages where student_id = (select id from ids where name = 'kid')), 'messages deleted');
select tests.assert((select parent_phone is null and parent_email is null and status = 'granted' and policy_version = 'v1'
                     from public.consents where student_id = (select id from ids where name = 'kid')), 'consent proof kept without contact details');
select tests.assert((select count(*) = 1 from public.invoices where id = (select id from ids where name = 'inv')), 'invoice kept (tax record)');
select tests.assert((select count(*) = 1 from public.orders where provider_order_id = 'order_dr_1'), 'order kept');

-- Idempotent
set role service_role;
select public.erase_student((select id from ids where name = 'kid'));
-- No orders → has_orders false
select tests.assert(not (public.erase_student((select id from ids where name = 'free')) ->> 'has_orders')::boolean, 'free student: nothing to keep');
reset role;

-- Staff accounts are refused
set role service_role;
do $$ begin
  perform public.erase_student((select id from ids where name = 'admin'));
  raise exception 'staff accounts cannot be erased by this RPC';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Deleting the auth user cascades to the profile; the request survives with subject_id.
delete from auth.users where id = (select id from ids where name = 'free');
insert into public.deletion_requests (student_id, subject_id, source, status, completed_at)
values (null, (select id from ids where name = 'free'), 'auto', 'completed', now());
select tests.assert((select count(*) = 1 from public.deletion_requests where subject_id = (select id from ids where name = 'free')), 'audit record outlives the account');
