\set QUIET on
create temp table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to authenticated, service_role;
insert into ids values
  ('kid', tests.create_user('kid@example.com', '{"full_name":"Asha Rao","class_level":"8","parent_phone":"98765 43210","parent_name":"Meera Rao","parent_email":"Meera@Example.com","parent_whatsapp_opt_in":true}')),
  ('other', tests.create_user('o@example.com', '{"full_name":"O","class_level":"7","parent_phone":"9123456789"}')),
  ('admin', tests.create_user('a@example.com', '{}')),
  ('course', '00000000-0000-4000-8000-000000000002');
update public.profiles set role = 'admin', account_status = 'active' where id = (select id from ids where name = 'admin');

select tests.assert((select parent_name = 'Meera Rao' and parent_email = 'meera@example.com' and parent_whatsapp_opt_in and account_status = 'pending_consent'
                     from public.profiles where id = (select id from ids where name = 'kid')), 'signup stores parent contact + opt-in');

-- Payment link (request) → order paid by the parent → invoice billed to the payer
insert into public.payment_requests (student_id, course_id, token_hash, expires_at)
values ((select id from ids where name = 'kid'), (select id from ids where name = 'course'), 'hash1', now() + interval '7 days');
insert into ids select 'req', id from public.payment_requests;
insert into public.orders (buyer_id, student_id, course_id, list_price_paise, total_paise, provider, provider_order_id, payer_name, payer_phone, payment_request_id)
select (select id from ids where name = 'kid'), (select id from ids where name = 'kid'), (select id from ids where name = 'course'), 49900, 49900, 'razorpay', 'order_wa_1',
       'Meera Rao', '+919876543210', (select id from ids where name = 'req');
insert into ids select 'inv', public.fulfill_order((select id from public.orders where provider_order_id = 'order_wa_1'), 'pay_wa_1', 49900, 'upi');
select tests.assert((select buyer_name = 'Meera Rao' and buyer_email = 'meera@example.com' and buyer_phone = '+919876543210' and student_name = 'Asha Rao'
                     from public.invoices where id = (select id from ids where name = 'inv')), 'invoice billed to the parent (payer), student named');
select tests.assert((select status = 'paid' from public.payment_requests where id = (select id from ids where name = 'req')), 'payment link marked paid');
select tests.assert((select status = 'active' from public.enrollments where user_id = (select id from ids where name = 'kid')), 'course unlocked');

-- Without payer details the parent on file is used.
insert into public.orders (buyer_id, student_id, course_id, list_price_paise, total_paise, provider, provider_order_id)
select (select id from ids where name = 'other'), (select id from ids where name = 'other'), (select id from ids where name = 'course'), 49900, 49900, 'razorpay', 'order_wa_2';
insert into ids select 'inv2', public.fulfill_order((select id from public.orders where provider_order_id = 'order_wa_2'), 'pay_wa_2', 49900, 'upi');
select tests.assert((select buyer_phone = '+919123456789' and buyer_email is null and buyer_name = 'Parent/guardian of O'
                     from public.invoices where id = (select id from ids where name = 'inv2')),
                    'falls back to the parent on file (never the child''s email)');

insert into public.whatsapp_messages (student_id, to_phone, template, body, status)
values ((select id from ids where name = 'kid'), '+919876543210', 'invoice', 'Hi', 'manual');

-- --- RLS ------------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'kid'));
select tests.assert((select count(*) = 1 from public.payment_requests), 'child sees own payment links');
select tests.assert((select count(*) = 1 from public.orders), 'child account sees its own order');
select tests.assert((select count(*) = 1 from public.invoices), 'and its invoice');
select tests.assert((select count(*) = 0 from public.whatsapp_messages), 'outbox is admin-only');
do $$ begin
  insert into public.payment_requests (student_id, course_id, token_hash, expires_at) values (auth.uid(), '00000000-0000-4000-8000-000000000002', 'x', now());
  raise exception 'payment links are created by the server only';
exception when insufficient_privilege then null;
end $$;
select tests.logout();
select tests.login_as((select id from ids where name = 'other'));
select tests.assert((select count(*) = 0 from public.payment_requests), 'no one else''s payment links');
select tests.logout();
select tests.login_as((select id from ids where name = 'admin'));
select tests.assert((select count(*) = 1 from public.whatsapp_messages), 'admin reads the outbox');
select tests.logout();
