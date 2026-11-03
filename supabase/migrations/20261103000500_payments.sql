-- =============================================================================
-- Milestone 5 — Payments, invoices, coupons, refunds
-- Money is integer paise everywhere. All writes go through server code
-- (service role) or the RPCs below; clients only read their own rows.
-- =============================================================================

create type public.coupon_kind as enum ('percent', 'flat');
create type public.order_status as enum ('created', 'paid', 'failed', 'refunded', 'cancelled');
create type public.payment_status as enum ('captured', 'failed', 'refunded');
create type public.refund_status as enum ('pending', 'processed', 'failed');
create type public.invoice_kind as enum ('invoice', 'credit_note');

-- ---------------------------------------------------------------------------
-- coupons
-- ---------------------------------------------------------------------------
create table public.coupons (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  kind        public.coupon_kind not null,
  value       integer not null check (value > 0),
  course_id   uuid references public.courses (id) on delete cascade,
  expires_at  timestamptz,
  usage_limit integer check (usage_limit > 0),
  used_count  integer not null default 0 check (used_count >= 0),
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint coupons_percent_range check (kind <> 'percent' or value between 1 and 100)
);
create index coupons_course_idx on public.coupons (course_id);
create index coupons_created_by_idx on public.coupons (created_by);
create trigger coupons_set_updated_at before update on public.coupons for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- orders — buyer (parent/admin) pays for a student's course
-- ---------------------------------------------------------------------------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  buyer_id          uuid not null references public.profiles (id) on delete restrict,
  student_id        uuid not null references public.profiles (id) on delete restrict,
  course_id         uuid not null references public.courses (id) on delete restrict,
  list_price_paise  integer not null check (list_price_paise >= 0),
  discount_paise    integer not null default 0 check (discount_paise >= 0),
  total_paise       integer not null check (total_paise >= 0),
  currency          text not null default 'INR' check (currency = 'INR'),
  coupon_id         uuid references public.coupons (id) on delete set null,
  status            public.order_status not null default 'created',
  provider          text not null check (provider in ('razorpay', 'mock', 'free')),
  provider_order_id text unique,
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint orders_total check (total_paise = list_price_paise - discount_paise)
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_student_idx on public.orders (student_id);
create index orders_course_idx on public.orders (course_id);
create index orders_coupon_idx on public.orders (coupon_id);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_paid_at_idx on public.orders (paid_at) where status = 'paid';
create trigger orders_set_updated_at before update on public.orders for each row execute function private.set_updated_at();

alter table public.enrollments
  add constraint enrollments_order_id_fkey foreign key (order_id) references public.orders (id) on delete set null;

create table public.coupon_redemptions (
  id         uuid primary key default gen_random_uuid(),
  coupon_id  uuid not null references public.coupons (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  order_id   uuid not null unique references public.orders (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupon_redemptions_once unique (coupon_id, user_id)
);
create index coupon_redemptions_user_idx on public.coupon_redemptions (user_id);

-- ---------------------------------------------------------------------------
-- payments / refunds
-- ---------------------------------------------------------------------------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete restrict,
  provider_payment_id text not null unique,
  status              public.payment_status not null,
  amount_paise        integer not null check (amount_paise >= 0),
  method              text check (char_length(method) <= 40),
  error_code          text check (char_length(error_code) <= 100),
  error_description   text check (char_length(error_description) <= 500),
  captured_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create trigger payments_set_updated_at before update on public.payments for each row execute function private.set_updated_at();

create table public.refunds (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete restrict,
  payment_id         uuid not null references public.payments (id) on delete restrict,
  provider_refund_id text unique,
  amount_paise       integer not null check (amount_paise > 0),
  status             public.refund_status not null default 'pending',
  reason             text check (char_length(reason) <= 500),
  requested_by       uuid references public.profiles (id) on delete set null,
  processed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index refunds_order_idx on public.refunds (order_id);
create index refunds_payment_idx on public.refunds (payment_id);
create index refunds_requested_by_idx on public.refunds (requested_by);
create unique index refunds_one_open_per_order on public.refunds (order_id) where status in ('pending', 'processed');
create trigger refunds_set_updated_at before update on public.refunds for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- invoices (+ credit notes) and gap-free counters per series × financial year
-- ---------------------------------------------------------------------------
create table public.invoice_counters (
  id          uuid primary key default gen_random_uuid(),
  series      text not null check (series ~ '^[A-Z]{2,5}$'),
  fy          text not null check (fy ~ '^\d{4}-\d{2}$'),
  last_number integer not null default 0 check (last_number >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint invoice_counters_unique unique (series, fy)
);
create trigger invoice_counters_set_updated_at before update on public.invoice_counters for each row execute function private.set_updated_at();

create table public.invoices (
  id                 uuid primary key default gen_random_uuid(),
  number             text not null unique,
  kind               public.invoice_kind not null default 'invoice',
  order_id           uuid not null references public.orders (id) on delete restrict,
  refund_id          uuid unique references public.refunds (id) on delete restrict,
  original_invoice_id uuid references public.invoices (id) on delete restrict,
  buyer_id           uuid not null references public.profiles (id) on delete restrict,
  buyer_name         text not null,
  buyer_email        text not null,
  student_name       text,
  line_items         jsonb not null check (jsonb_typeof(line_items) = 'array'),
  taxable_paise      integer not null check (taxable_paise >= 0),
  cgst_paise         integer not null default 0 check (cgst_paise >= 0),
  sgst_paise         integer not null default 0 check (sgst_paise >= 0),
  igst_paise         integer not null default 0 check (igst_paise >= 0),
  total_paise        integer not null check (total_paise >= 0),
  tax_snapshot       jsonb not null, -- seller, GSTIN, SAC, rates, mode: frozen at issue time
  provider_payment_id text,
  is_test            boolean not null default false,
  pdf_path           text,
  emailed_at         timestamptz,
  issued_at          timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint invoices_tax_sum check (taxable_paise + cgst_paise + sgst_paise + igst_paise = total_paise),
  constraint invoices_credit_note_shape check (
    (kind = 'invoice' and refund_id is null and original_invoice_id is null)
    or (kind = 'credit_note' and refund_id is not null and original_invoice_id is not null)
  )
);
create unique index invoices_one_per_order on public.invoices (order_id) where kind = 'invoice';
create index invoices_buyer_idx on public.invoices (buyer_id, issued_at desc);
create index invoices_original_idx on public.invoices (original_invoice_id);
create index invoices_issued_idx on public.invoices (issued_at desc);
create trigger invoices_set_updated_at before update on public.invoices for each row execute function private.set_updated_at();

-- Issued invoices are immutable except for delivery bookkeeping.
create or replace function private.invoices_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - array['pdf_path', 'emailed_at', 'updated_at']) is distinct from (to_jsonb(old) - array['pdf_path', 'emailed_at', 'updated_at']) then
    raise exception 'issued invoices are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger invoices_immutable before update on public.invoices for each row execute function private.invoices_immutable();
create or replace function private.invoices_immutable_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Test invoices (mock gateway, own number series) may be cleaned up; real ones never.
  if old.is_test then return old; end if;
  raise exception 'invoices cannot be deleted (issue a credit note)' using errcode = '42501';
end;
$$;
create trigger invoices_no_delete before delete on public.invoices for each row execute function private.invoices_immutable_delete();

-- ---------------------------------------------------------------------------
-- webhook_events (idempotency) and email_log
-- ---------------------------------------------------------------------------
create table public.webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_id     text not null,
  event_type   text not null,
  status       text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  error        text check (char_length(error) <= 1000),
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint webhook_events_unique unique (provider, event_id)
);
create index webhook_events_received_idx on public.webhook_events (received_at desc);
create trigger webhook_events_set_updated_at before update on public.webhook_events for each row execute function private.set_updated_at();

create table public.email_log (
  id           uuid primary key default gen_random_uuid(),
  to_email     text not null,
  template     text not null check (char_length(template) <= 60),
  subject      text not null check (char_length(subject) <= 200),
  status       text not null check (status in ('sent', 'logged', 'failed')),
  provider_id  text,
  error        text check (char_length(error) <= 1000),
  related_type text,
  related_id   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index email_log_related_idx on public.email_log (related_type, related_id);
create index email_log_created_idx on public.email_log (created_at desc);
create trigger email_log_set_updated_at before update on public.email_log for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Settings defaults (PLACEHOLDERS — edit in /admin/settings)
-- ---------------------------------------------------------------------------
insert into public.settings (key, value, description) values
  ('business.name', '"AI Learning Hub (placeholder business name)"', 'Seller name printed on invoices'),
  ('business.address', '"Address line 1, City, State, PIN (placeholder)"', 'Seller address printed on invoices'),
  ('business.gstin', '""', 'GSTIN; leave empty if not GST-registered'),
  ('business.email', '"billing@example.com"', 'Contact email printed on invoices'),
  ('tax.mode', '"none"', 'none | cgst_sgst | igst'),
  ('tax.rate_percent', '18', 'Total GST rate in percent (split equally for CGST+SGST)'),
  ('tax.prices_include_tax', 'true', 'Course prices already include GST'),
  ('invoice.sac_code', '"999293"', 'SAC code for the service (confirm with your accountant)'),
  ('invoice.prefix', '"INV"', 'Invoice number series'),
  ('invoice.credit_note_prefix', '"CN"', 'Credit note number series'),
  ('invoice.footer', '"This is a computer-generated invoice."', 'Footer note'),
  ('refund.window_days', '7', 'Days after purchase during which refunds are offered')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.setting(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select value from public.settings where key = p_key;
$$;

/* Indian financial year (April–March, India time) as '2026-27'. */
create or replace function private.financial_year(p_at timestamptz) returns text
language sql immutable set search_path = '' as $$
  select case
    when extract(month from (p_at at time zone 'Asia/Kolkata')) >= 4
      then extract(year from (p_at at time zone 'Asia/Kolkata'))::int::text || '-' ||
           lpad(((extract(year from (p_at at time zone 'Asia/Kolkata'))::int + 1) % 100)::text, 2, '0')
    else (extract(year from (p_at at time zone 'Asia/Kolkata'))::int - 1)::text || '-' ||
         lpad((extract(year from (p_at at time zone 'Asia/Kolkata'))::int % 100)::text, 2, '0')
  end;
$$;

/*
 * Next number in a series for the current FY. The counter row is locked by the
 * UPDATE, so concurrent callers queue; because it runs inside the caller's
 * transaction, a rollback also rolls back the number → no gaps, no duplicates.
 */
create or replace function private.next_document_number(p_series text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_fy  text := private.financial_year(now());
  v_n   integer;
begin
  insert into public.invoice_counters (series, fy) values (p_series, v_fy) on conflict (series, fy) do nothing;
  update public.invoice_counters set last_number = last_number + 1
   where series = p_series and fy = v_fy
  returning last_number into v_n;
  return p_series || '/' || v_fy || '/' || lpad(v_n::text, 6, '0');
end;
$$;

/* GST split of a tax-inclusive (or exclusive) amount per current settings. */
create or replace function private.tax_breakup(p_amount integer)
returns table (taxable integer, cgst integer, sgst integer, igst integer, snapshot jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_mode    text := coalesce(private.setting('tax.mode') #>> '{}', 'none');
  v_rate    numeric := coalesce((private.setting('tax.rate_percent') #>> '{}')::numeric, 0);
  v_tax     integer := 0;
begin
  if v_mode not in ('cgst_sgst', 'igst') or v_rate <= 0 then
    v_mode := 'none';
    v_rate := 0;
  end if;
  -- Prices include tax: taxable = round(amount × 100 / (100 + rate)).
  taxable := round(p_amount * 100 / (100 + v_rate));
  v_tax := p_amount - taxable;
  cgst := 0; sgst := 0; igst := 0;
  if v_mode = 'cgst_sgst' then
    cgst := v_tax / 2;           -- integer division
    sgst := v_tax - cgst;        -- odd paise go to SGST
  elsif v_mode = 'igst' then
    igst := v_tax;
  end if;
  snapshot := jsonb_build_object(
    'mode', v_mode,
    'rate_percent', v_rate,
    'seller_name', private.setting('business.name') #>> '{}',
    'seller_address', private.setting('business.address') #>> '{}',
    'seller_gstin', nullif(private.setting('business.gstin') #>> '{}', ''),
    'seller_email', private.setting('business.email') #>> '{}',
    'sac_code', private.setting('invoice.sac_code') #>> '{}',
    'footer', private.setting('invoice.footer') #>> '{}'
  );
  return next;
end;
$$;

revoke all on function private.setting(text) from public;
revoke all on function private.next_document_number(text) from public;
revoke all on function private.tax_breakup(integer) from public;
grant execute on function private.setting(text), private.next_document_number(text), private.tax_breakup(integer), private.financial_year(timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- fulfill_order: payment + order paid + enrolment + coupon + invoice, atomically.
-- Idempotent: a second call (verify + webhook race) returns the same invoice.
-- ---------------------------------------------------------------------------
create or replace function public.fulfill_order(
  p_order_id uuid, p_provider_payment_id text, p_amount_paise integer, p_method text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_order   public.orders;
  v_buyer   public.profiles;
  v_student public.profiles;
  v_course  public.courses;
  v_tax     record;
  v_invoice uuid;
  v_test    boolean;
  v_prefix  text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;

  if v_order.status = 'paid' then
    select id into v_invoice from public.invoices where order_id = p_order_id and kind = 'invoice';
    return v_invoice;
  end if;
  if v_order.status not in ('created', 'failed') then
    raise exception 'order is %', v_order.status using errcode = '22023';
  end if;
  if p_amount_paise <> v_order.total_paise then
    raise exception 'amount mismatch: paid % expected %', p_amount_paise, v_order.total_paise using errcode = '22023';
  end if;

  select * into v_buyer from public.profiles where id = v_order.buyer_id;
  select * into v_student from public.profiles where id = v_order.student_id;
  select * into v_course from public.courses where id = v_order.course_id;
  v_test := v_order.provider = 'mock';

  if p_provider_payment_id is not null then
    insert into public.payments (order_id, provider_payment_id, status, amount_paise, method, captured_at)
    values (p_order_id, p_provider_payment_id, 'captured', p_amount_paise, p_method, now())
    on conflict (provider_payment_id) do update set status = 'captured', captured_at = coalesce(public.payments.captured_at, now());
  end if;

  update public.orders set status = 'paid', paid_at = now() where id = p_order_id;

  insert into public.enrollments (user_id, course_id, source, status, order_id)
  values (v_order.student_id, v_order.course_id, 'purchase', 'active', p_order_id)
  on conflict (user_id, course_id) do update set status = 'active', source = 'purchase', order_id = excluded.order_id;

  if v_order.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id)
    values (v_order.coupon_id, v_order.buyer_id, p_order_id) on conflict do nothing;
    update public.coupons set used_count = used_count + 1 where id = v_order.coupon_id;
  end if;

  select * into v_tax from private.tax_breakup(v_order.total_paise);
  v_prefix := coalesce(private.setting('invoice.prefix') #>> '{}', 'INV');

  insert into public.invoices (
    number, kind, order_id, buyer_id, buyer_name, buyer_email, student_name, line_items,
    taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise, tax_snapshot, provider_payment_id, is_test
  ) values (
    case when v_test then 'TEST-' || private.next_document_number('T' || v_prefix) else private.next_document_number(v_prefix) end,
    'invoice', p_order_id, v_buyer.id, coalesce(v_buyer.full_name, v_buyer.email), v_buyer.email, v_student.full_name,
    jsonb_build_array(jsonb_build_object(
      'description', 'Online course: ' || v_course.title,
      'sac', v_tax.snapshot ->> 'sac_code',
      'quantity', 1,
      'list_price_paise', v_order.list_price_paise,
      'discount_paise', v_order.discount_paise,
      'amount_paise', v_order.total_paise
    )),
    v_tax.taxable, v_tax.cgst, v_tax.sgst, v_tax.igst, v_order.total_paise, v_tax.snapshot, p_provider_payment_id, v_test
  ) returning id into v_invoice;

  return v_invoice;
end;
$$;

create or replace function public.mark_payment_failed(
  p_order_id uuid, p_provider_payment_id text, p_amount_paise integer, p_code text, p_description text
)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.payments (order_id, provider_payment_id, status, amount_paise, error_code, error_description)
  values (p_order_id, p_provider_payment_id, 'failed', p_amount_paise, left(p_code, 100), left(p_description, 500))
  on conflict (provider_payment_id) do nothing;
  update public.orders set status = 'failed' where id = p_order_id and status = 'created';
end;
$$;

/* Refund confirmed by the gateway: revoke access + issue a credit note (idempotent). */
create or replace function public.process_refund(p_refund_id uuid, p_provider_refund_id text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_refund   public.refunds;
  v_order    public.orders;
  v_original public.invoices;
  v_tax      record;
  v_cn       uuid;
  v_prefix   text;
begin
  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then raise exception 'refund not found' using errcode = 'P0002'; end if;
  if v_refund.status = 'processed' then
    select id into v_cn from public.invoices where refund_id = p_refund_id;
    return v_cn;
  end if;

  select * into v_order from public.orders where id = v_refund.order_id for update;
  select * into v_original from public.invoices where order_id = v_order.id and kind = 'invoice';

  update public.refunds set status = 'processed', processed_at = now(), provider_refund_id = coalesce(p_provider_refund_id, provider_refund_id)
   where id = p_refund_id;
  update public.payments set status = 'refunded' where id = v_refund.payment_id;
  update public.orders set status = 'refunded' where id = v_order.id;
  update public.enrollments set status = 'revoked' where order_id = v_order.id;

  if v_original.id is not null then
    -- Credit note mirrors the original invoice's tax treatment (frozen snapshot).
    v_prefix := coalesce(private.setting('invoice.credit_note_prefix') #>> '{}', 'CN');
    select * into v_tax from private.tax_breakup(v_refund.amount_paise);
    insert into public.invoices (
      number, kind, order_id, refund_id, original_invoice_id, buyer_id, buyer_name, buyer_email, student_name,
      line_items, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise, tax_snapshot, provider_payment_id, is_test
    ) values (
      case when v_original.is_test then 'TEST-' || private.next_document_number('T' || v_prefix) else private.next_document_number(v_prefix) end,
      'credit_note', v_order.id, p_refund_id, v_original.id, v_original.buyer_id, v_original.buyer_name, v_original.buyer_email,
      v_original.student_name,
      jsonb_build_array(jsonb_build_object('description', 'Refund against ' || v_original.number, 'sac', v_original.tax_snapshot ->> 'sac_code',
                                           'quantity', 1, 'amount_paise', v_refund.amount_paise)),
      case when v_refund.amount_paise = v_original.total_paise then v_original.taxable_paise else v_tax.taxable end,
      case when v_refund.amount_paise = v_original.total_paise then v_original.cgst_paise else v_tax.cgst end,
      case when v_refund.amount_paise = v_original.total_paise then v_original.sgst_paise else v_tax.sgst end,
      case when v_refund.amount_paise = v_original.total_paise then v_original.igst_paise else v_tax.igst end,
      v_refund.amount_paise, v_original.tax_snapshot, v_original.provider_payment_id, v_original.is_test
    ) returning id into v_cn;
  end if;
  return v_cn;
end;
$$;

revoke all on function public.fulfill_order(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.mark_payment_failed(uuid, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.process_refund(uuid, text) from public, anon, authenticated;
grant execute on function public.fulfill_order(uuid, text, integer, text) to service_role;
grant execute on function public.mark_payment_failed(uuid, text, integer, text, text) to service_role;
grant execute on function public.process_refund(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------
revoke all on public.coupons, public.coupon_redemptions, public.orders, public.payments, public.refunds,
              public.invoices, public.invoice_counters, public.webhook_events, public.email_log from anon, authenticated;
grant select on public.orders, public.payments, public.refunds, public.invoices to authenticated;
grant select on public.coupons, public.coupon_redemptions, public.webhook_events, public.email_log to authenticated;
grant all on public.coupons, public.coupon_redemptions, public.orders, public.payments, public.refunds,
             public.invoices, public.invoice_counters, public.webhook_events, public.email_log to service_role;

alter table public.coupons            enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.orders             enable row level security;
alter table public.payments           enable row level security;
alter table public.refunds            enable row level security;
alter table public.invoices           enable row level security;
alter table public.invoice_counters   enable row level security; -- service role only
alter table public.webhook_events     enable row level security;
alter table public.email_log          enable row level security;

create or replace function private.owns_order(p_order_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orders o where o.id = p_order_id and o.buyer_id = auth.uid());
$$;
revoke all on function private.owns_order(uuid) from public;
grant execute on function private.owns_order(uuid) to authenticated;

-- Buyers see their orders/payments/refunds/invoices; admins see all. Content editors never see money.
create policy "orders: buyer or admin" on public.orders for select to authenticated
  using (buyer_id = (select auth.uid()) or (select private.is_admin()));
create policy "payments: buyer or admin" on public.payments for select to authenticated
  using ((select private.owns_order(order_id)) or (select private.is_admin()));
create policy "refunds: buyer or admin" on public.refunds for select to authenticated
  using ((select private.owns_order(order_id)) or (select private.is_admin()));
create policy "invoices: buyer or admin" on public.invoices for select to authenticated
  using (buyer_id = (select auth.uid()) or (select private.is_admin()));
create policy "coupons: admin" on public.coupons for select to authenticated using ((select private.is_admin()));
create policy "redemptions: admin" on public.coupon_redemptions for select to authenticated using ((select private.is_admin()));
create policy "webhooks: admin" on public.webhook_events for select to authenticated using ((select private.is_admin()));
create policy "email_log: admin" on public.email_log for select to authenticated using ((select private.is_admin()));

-- Private invoice PDFs: no client policies; downloads use short-lived signed URLs created server-side.
do $migration$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not present; skipping invoices bucket';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('invoices', 'invoices', false, 2097152, array['application/pdf'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
end;
$migration$;
