\set QUIET on
create temp table ids (name text primary key, id uuid) on commit drop;
grant select, insert on ids to anon, authenticated, service_role;
insert into ids values
  ('parent', tests.create_user('parent@example.com', '{"signup_role":"parent","full_name":"Meera Rao"}')),
  ('kid', tests.create_user('kid@example.com', '{"full_name":"Asha Rao","class_level":"8","parent_phone":"98765 43210","parent_email":"parent@example.com"}')),
  ('other', tests.create_user('other@example.com', '{"signup_role":"parent","full_name":"Other"}')),
  ('editor', tests.create_user('ed@example.com', '{}')),
  ('admin', tests.create_user('admin@example.com', '{}')),
  ('course', '00000000-0000-4000-8000-000000000002');
update public.profiles set role = 'content_editor', account_status = 'active' where id = (select id from ids where name = 'editor');
update public.profiles set role = 'admin', account_status = 'active' where id = (select id from ids where name = 'admin');

-- --- financial year + tax math ------------------------------------------------
select tests.assert(private.financial_year('2026-04-01 00:00+05:30') = '2026-27', 'FY starts 1 April IST');
select tests.assert(private.financial_year('2026-03-31 23:59+05:30') = '2025-26', 'FY ends 31 March IST');
select tests.assert(private.financial_year('2026-03-31 19:00+00') = '2026-27', 'UTC evening of 31 Mar is already April in IST');
select tests.assert(private.financial_year('2099-06-01') = '2099-00', 'century wrap');

select tests.assert((select taxable = 49900 and cgst + sgst + igst = 0 and snapshot ->> 'mode' = 'none' from private.tax_breakup(49900)), 'default: no tax');
update public.settings set value = '"cgst_sgst"' where key = 'tax.mode';
select tests.assert((select taxable = 42288 and cgst = 3806 and sgst = 3806 and taxable + cgst + sgst = 49900 from private.tax_breakup(49900)), 'CGST+SGST 18% inclusive');
select tests.assert((select taxable = 85 and cgst = 7 and sgst = 8 from private.tax_breakup(100)), 'odd paise go to SGST');
update public.settings set value = '"igst"' where key = 'tax.mode';
select tests.assert((select igst = 7612 and cgst = 0 from private.tax_breakup(49900)), 'IGST');
update public.settings set value = '"cgst_sgst"' where key = 'tax.mode';

-- --- gap-free numbering --------------------------------------------------------
select tests.assert(private.next_document_number('XINV') like 'XINV/____-__/000001', 'first number');
savepoint s1;
select private.next_document_number('XINV');
rollback to savepoint s1;
select tests.assert(private.next_document_number('XINV') like 'XINV/____-__/000002', 'rolled-back number is reused → no gaps');

-- --- order → fulfil ---------------------------------------------------------------
insert into public.coupons (code, kind, value) values ('FAMILY10', 'percent', 10);
insert into public.orders (buyer_id, student_id, course_id, list_price_paise, discount_paise, total_paise, coupon_id, provider, provider_order_id, payer_name)
select (select id from ids where name = 'parent'), (select id from ids where name = 'kid'), (select id from ids where name = 'course'),
       49900, 4990, 44910, (select id from public.coupons where code = 'FAMILY10'), 'razorpay', 'order_live_1', 'Meera Rao';
insert into ids select 'order', id from public.orders where provider_order_id = 'order_live_1';

do $$ begin
  perform public.fulfill_order((select id from ids where name = 'order'), 'pay_1', 100, 'upi');
  raise exception 'amount mismatch must be refused';
exception when sqlstate '22023' then null;
end $$;

insert into ids select 'inv', public.fulfill_order((select id from ids where name = 'order'), 'pay_1', 44910, 'upi');
select tests.assert(public.fulfill_order((select id from ids where name = 'order'), 'pay_1', 44910, 'upi') = (select id from ids where name = 'inv'), 'idempotent (verify + webhook race)');
select tests.assert((select count(*) = 1 from public.payments where order_id = (select id from ids where name = 'order')), 'one payment row');
select tests.assert((select status = 'paid' from public.orders where id = (select id from ids where name = 'order')), 'order paid');
select tests.assert((select status = 'active' and source = 'purchase' from public.enrollments where user_id = (select id from ids where name = 'kid')), 'student enrolled');
select tests.assert((select used_count = 1 from public.coupons where code = 'FAMILY10'), 'coupon counted once');
select tests.assert(
  (select number like 'INV/____-__/000001' and total_paise = 44910 and taxable_paise + cgst_paise + sgst_paise = 44910
          and cgst_paise > 0 and buyer_name = 'Meera Rao' and student_name = 'Asha Rao' and not is_test
          and tax_snapshot ->> 'sac_code' = '999293'
     from public.invoices where id = (select id from ids where name = 'inv')),
  'invoice issued with GST split + snapshot');

do $$ begin
  update public.invoices set total_paise = 1 where id = (select id from ids where name = 'inv');
  raise exception 'invoices must be immutable';
exception when insufficient_privilege then null;
end $$;
update public.invoices set pdf_path = 'x.pdf' where id = (select id from ids where name = 'inv'); -- delivery bookkeeping is allowed
do $$ begin
  delete from public.invoices where id = (select id from ids where name = 'inv');
  raise exception 'real invoices cannot be deleted';
exception when insufficient_privilege then null;
end $$;

-- mock-gateway orders use a separate TEST series and are deletable
insert into public.orders (buyer_id, student_id, course_id, list_price_paise, total_paise, provider, provider_order_id)
select (select id from ids where name = 'other'), (select id from ids where name = 'editor'), (select id from ids where name = 'course'), 49900, 49900, 'mock', 'order_mock_1';
insert into ids select 'mock_inv', public.fulfill_order((select id from public.orders where provider_order_id = 'order_mock_1'), 'pay_mock_1', 49900, 'mock');
select tests.assert((select number like 'TEST-TINV/____-__/000001' and is_test from public.invoices where id = (select id from ids where name = 'mock_inv')), 'test series');
delete from public.invoices where id = (select id from ids where name = 'mock_inv');

-- --- refund → revoke + credit note -------------------------------------------------
insert into public.refunds (order_id, payment_id, amount_paise, reason, requested_by)
select (select id from ids where name = 'order'), p.id, 44910, 'Changed mind', (select id from ids where name = 'admin')
from public.payments p where p.provider_payment_id = 'pay_1';
insert into ids select 'refund', id from public.refunds limit 1;
insert into ids select 'cn', public.process_refund((select id from ids where name = 'refund'), 'rfnd_1');
select tests.assert(public.process_refund((select id from ids where name = 'refund'), 'rfnd_1') = (select id from ids where name = 'cn'), 'refund processing idempotent');
select tests.assert((select status = 'revoked' from public.enrollments where user_id = (select id from ids where name = 'kid')), 'access revoked');
select tests.assert((select status = 'refunded' from public.orders where id = (select id from ids where name = 'order')), 'order refunded');
select tests.assert(
  (select number like 'CN/____-__/000001' and kind = 'credit_note' and total_paise = 44910
          and original_invoice_id = (select id from ids where name = 'inv')
     from public.invoices where id = (select id from ids where name = 'cn')),
  'credit note in its own series, linked to the original');
do $$ begin
  insert into public.refunds (order_id, payment_id, amount_paise)
  select (select id from ids where name = 'order'), id, 1 from public.payments where provider_payment_id = 'pay_1';
  raise exception 'only one refund per order';
exception when unique_violation then null;
end $$;

-- --- RLS ------------------------------------------------------------------------
select tests.login_as((select id from ids where name = 'parent'));
select tests.assert((select count(*) = 1 from public.orders), 'buyer sees own order');
select tests.assert((select count(*) = 2 from public.invoices), 'buyer sees invoice + credit note');
select tests.assert((select count(*) = 1 from public.payments), 'buyer sees own payment');
select tests.assert((select count(*) = 0 from public.coupons), 'buyers cannot list coupons');
do $$ begin
  perform public.fulfill_order((select id from ids where name = 'order'), 'pay_x', 0, 'x');
  raise exception 'clients must not fulfil orders';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.orders (buyer_id, student_id, course_id, list_price_paise, total_paise, provider)
  values (auth.uid(), auth.uid(), '00000000-0000-4000-8000-000000000002', 0, 0, 'free');
  raise exception 'clients must not create orders';
exception when insufficient_privilege then null;
end $$;
select tests.logout();

select tests.login_as((select id from ids where name = 'other'));
select tests.assert((select count(*) = 0 from public.invoices where buyer_id <> auth.uid()), 'no one else''s invoices');
select tests.logout();
select tests.login_as((select id from ids where name = 'kid'));
select tests.assert((select count(*) = 0 from public.orders), 'students do not see payment details');
select tests.logout();
select tests.login_as((select id from ids where name = 'editor'));
select tests.assert((select count(*) = 0 from public.orders) and (select count(*) = 0 from public.invoices), 'content editors cannot see payments');
select tests.logout();
select tests.login_as((select id from ids where name = 'admin'));
select tests.assert((select count(*) >= 2 from public.orders) and (select count(*) = 1 from public.coupons), 'admin sees all');
select tests.logout();
