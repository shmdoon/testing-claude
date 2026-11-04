-- =============================================================================
-- WhatsApp-first parent model (business decision 2026-11-04)
-- * No parent accounts or dashboard. Each child has ONE account (created by
--   the child or a parent). Parents are reached on WhatsApp.
-- * Signup collects the parent's WhatsApp number (+ optional email/name).
-- * Consent, payment links, invoices, weekly summaries and teacher feedback
--   go to the parent via WhatsApp (API or manual outbox).
-- parent_student_links / the 'parent' role are left in place but unused.
-- =============================================================================

-- Indian-friendly phone normalisation → E.164 (+91XXXXXXXXXX by default).
create or replace function private.normalize_phone(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  d text := regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g');
begin
  if d ~ '^\+[1-9][0-9]{7,14}$' then return d; end if;
  d := regexp_replace(d, '\D', '', 'g');
  if d ~ '^0?[6-9][0-9]{9}$' then return '+91' || right(d, 10); end if;
  if d ~ '^91[6-9][0-9]{9}$' then return '+' || d; end if;
  return null;
end;
$$;

-- --- profiles -----------------------------------------------------------------
alter table public.profiles
  add column parent_name text check (char_length(parent_name) <= 120),
  add column parent_phone text check (parent_phone ~ '^\+[1-9][0-9]{7,14}$'),
  add column parent_whatsapp_opt_in boolean not null default false,
  add column gallery_consent boolean not null default false;
create index profiles_parent_phone_idx on public.profiles (parent_phone) where parent_phone is not null;

-- --- consents -----------------------------------------------------------------
alter table public.consents
  alter column parent_email drop not null,
  add column parent_phone text check (parent_phone ~ '^\+[1-9][0-9]{7,14}$'),
  add column whatsapp_opt_in boolean not null default false,
  add column gallery_consent boolean not null default false,
  add column method text check (method in ('whatsapp_link', 'admin'));

-- --- signup trigger: every signup is a student --------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name   text := nullif(btrim(left(meta ->> 'full_name', 120)), '');
  v_class  smallint;
  v_phone  text := private.normalize_phone(meta ->> 'parent_phone');
  v_pemail text := nullif(lower(btrim(meta ->> 'parent_email')), '');
  v_pname  text := nullif(btrim(left(meta ->> 'parent_name', 120)), '');
  v_status public.account_status;
begin
  if (meta ->> 'class_level') ~ '^\d{1,2}$' and (meta ->> 'class_level')::int between 1 and 12 then
    v_class := (meta ->> 'class_level')::smallint;
  end if;
  if v_pemail is not null and (v_pemail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or v_pemail = lower(new.email)) then
    v_pemail := null;
  end if;
  v_status := case when v_name is not null and v_class is not null and v_phone is not null then 'pending_consent' else 'pending_profile' end;

  insert into public.profiles (id, email, full_name, role, account_status, class_level, parent_email, parent_name, parent_phone, parent_whatsapp_opt_in, acquisition)
  values (new.id, lower(new.email), v_name, 'student', v_status, v_class, v_pemail, v_pname, v_phone,
          coalesce((meta ->> 'parent_whatsapp_opt_in')::boolean, false),
          case when jsonb_typeof(meta -> 'acquisition') = 'object' then private.clean_acquisition(meta -> 'acquisition') end);

  if v_status = 'pending_consent' then
    insert into public.consents (student_id, parent_email, parent_phone) values (new.id, v_pemail, v_phone);
  end if;
  return new;
end;
$$;

-- --- complete profile (e.g. after Google signup) --------------------------------
drop function if exists public.complete_student_profile(text, smallint, text);
drop function if exists public.complete_parent_profile(text);

create or replace function public.complete_student_profile(
  p_full_name text, p_class_level smallint, p_parent_phone text, p_parent_email text, p_parent_name text, p_whatsapp_opt_in boolean
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_phone text := private.normalize_phone(p_parent_phone);
  v_pemail text := nullif(lower(btrim(coalesce(p_parent_email, ''))), '');
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select email into v_email from public.profiles where id = v_uid and role = 'student' and account_status = 'pending_profile';
  if not found then raise exception 'profile cannot be completed' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_full_name, ''))) not between 1 and 120 or p_class_level not between 1 and 12 or v_phone is null
     or (v_pemail is not null and (v_pemail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or v_pemail = v_email)) then
    raise exception 'invalid profile data' using errcode = '22023';
  end if;
  update public.profiles
     set full_name = btrim(p_full_name), class_level = p_class_level, parent_phone = v_phone, parent_email = v_pemail,
         parent_name = nullif(btrim(left(coalesce(p_parent_name, ''), 120)), ''), parent_whatsapp_opt_in = coalesce(p_whatsapp_opt_in, false),
         account_status = 'pending_consent'
   where id = v_uid;
  insert into public.consents (student_id, parent_email, parent_phone) values (v_uid, v_pemail, v_phone);
end;
$$;
revoke all on function public.complete_student_profile(text, smallint, text, text, text, boolean) from public, anon;
grant execute on function public.complete_student_profile(text, smallint, text, text, text, boolean) to authenticated;

-- --- consent (granted via the parent's WhatsApp link, or by an admin) -----------
create or replace function public.grant_consent(
  p_consent_id uuid, p_method text, p_whatsapp_opt_in boolean, p_gallery boolean, p_policy_version text
)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_c public.consents;
begin
  select * into v_c from public.consents where id = p_consent_id for update;
  if not found then raise exception 'consent not found' using errcode = 'P0002'; end if;
  if v_c.status = 'granted' then return; end if;
  update public.consents
     set status = 'granted', granted_at = now(), method = p_method, whatsapp_opt_in = coalesce(p_whatsapp_opt_in, false),
         gallery_consent = coalesce(p_gallery, false), policy_version = p_policy_version, token_hash = null
   where id = p_consent_id;
  update public.profiles
     set account_status = 'active', parent_whatsapp_opt_in = coalesce(p_whatsapp_opt_in, false), gallery_consent = coalesce(p_gallery, false)
   where id = v_c.student_id and account_status = 'pending_consent';
end;
$$;
revoke all on function public.grant_consent(uuid, text, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.grant_consent(uuid, text, boolean, boolean, text) to service_role;

-- --- payments: the child's account buys; the payer is recorded for the invoice ---
create table public.payment_requests (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  status      text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index payment_requests_student_idx on public.payment_requests (student_id);
create index payment_requests_course_idx on public.payment_requests (course_id);
create trigger payment_requests_set_updated_at before update on public.payment_requests for each row execute function private.set_updated_at();

alter table public.orders
  add column payer_name text check (char_length(payer_name) <= 120),
  add column payer_email text check (payer_email = lower(payer_email)),
  add column payer_phone text check (payer_phone ~ '^\+[1-9][0-9]{7,14}$'),
  add column payment_request_id uuid references public.payment_requests (id) on delete set null;
create index orders_payment_request_idx on public.orders (payment_request_id);

alter table public.invoices
  alter column buyer_email drop not null,
  add column buyer_phone text;

-- Invoices are billed to the payer (parent/guardian) when given.
create or replace function private.invoice_buyer(p_order public.orders, out name text, out email text, out phone text)
language plpgsql stable security definer set search_path = '' as $$
declare v_p public.profiles;
begin
  select * into v_p from public.profiles where id = p_order.buyer_id;
  name := coalesce(p_order.payer_name, v_p.parent_name, v_p.full_name, v_p.email);
  email := coalesce(p_order.payer_email, v_p.parent_email, case when p_order.payer_name is null then v_p.email end);
  phone := coalesce(p_order.payer_phone, v_p.parent_phone);
end;
$$;

create or replace function public.fulfill_order(
  p_order_id uuid, p_provider_payment_id text, p_amount_paise integer, p_method text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_order   public.orders;
  v_student public.profiles;
  v_course  public.courses;
  v_buyer   record;
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
  if v_order.status not in ('created', 'failed') then raise exception 'order is %', v_order.status using errcode = '22023'; end if;
  if p_amount_paise <> v_order.total_paise then
    raise exception 'amount mismatch: paid % expected %', p_amount_paise, v_order.total_paise using errcode = '22023';
  end if;

  select * into v_student from public.profiles where id = v_order.student_id;
  select * into v_course from public.courses where id = v_order.course_id;
  select * into v_buyer from private.invoice_buyer(v_order);
  v_test := v_order.provider = 'mock';

  if p_provider_payment_id is not null then
    insert into public.payments (order_id, provider_payment_id, status, amount_paise, method, captured_at)
    values (p_order_id, p_provider_payment_id, 'captured', p_amount_paise, p_method, now())
    on conflict (provider_payment_id) do update set status = 'captured', captured_at = coalesce(public.payments.captured_at, now());
  end if;
  update public.orders set status = 'paid', paid_at = now() where id = p_order_id;
  if v_order.payment_request_id is not null then
    update public.payment_requests set status = 'paid' where id = v_order.payment_request_id;
  end if;
  insert into public.enrollments (user_id, course_id, source, status, order_id)
  values (v_order.student_id, v_order.course_id, 'purchase', 'active', p_order_id)
  on conflict (user_id, course_id) do update set status = 'active', source = 'purchase', order_id = excluded.order_id;
  if v_order.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id) values (v_order.coupon_id, v_order.buyer_id, p_order_id) on conflict do nothing;
    update public.coupons set used_count = used_count + 1 where id = v_order.coupon_id;
  end if;

  select * into v_tax from private.tax_breakup(v_order.total_paise);
  v_prefix := coalesce(private.setting('invoice.prefix') #>> '{}', 'INV');
  insert into public.invoices (
    number, kind, order_id, buyer_id, buyer_name, buyer_email, buyer_phone, student_name, line_items,
    taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise, tax_snapshot, provider_payment_id, is_test
  ) values (
    case when v_test then 'TEST-' || private.next_document_number('T' || v_prefix) else private.next_document_number(v_prefix) end,
    'invoice', p_order_id, v_order.buyer_id, v_buyer.name, v_buyer.email, v_buyer.phone, v_student.full_name,
    jsonb_build_array(jsonb_build_object('description', 'Online course: ' || v_course.title, 'sac', v_tax.snapshot ->> 'sac_code', 'quantity', 1,
      'list_price_paise', v_order.list_price_paise, 'discount_paise', v_order.discount_paise, 'amount_paise', v_order.total_paise)),
    v_tax.taxable, v_tax.cgst, v_tax.sgst, v_tax.igst, v_order.total_paise, v_tax.snapshot, p_provider_payment_id, v_test
  ) returning id into v_invoice;
  return v_invoice;
end;
$$;

-- Credit notes copy buyer phone too.
create or replace function private.copy_buyer_phone() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.kind = 'credit_note' and new.buyer_phone is null then
    select buyer_phone into new.buyer_phone from public.invoices where id = new.original_invoice_id;
  end if;
  return new;
end;
$$;
create trigger invoices_copy_buyer_phone before insert on public.invoices for each row execute function private.copy_buyer_phone();

-- --- WhatsApp outbox -------------------------------------------------------------
create table public.whatsapp_messages (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid references public.profiles (id) on delete cascade,
  to_phone     text not null check (to_phone ~ '^\+[1-9][0-9]{7,14}$'),
  template     text not null check (char_length(template) <= 60),
  params       jsonb not null default '[]'::jsonb check (jsonb_typeof(params) = 'array'),
  body         text not null check (char_length(body) <= 2000), -- plain text for manual sending
  status       text not null check (status in ('sent', 'manual', 'manual_sent', 'failed', 'cancelled')),
  provider_id  text,
  error        text check (char_length(error) <= 1000),
  related_type text,
  related_id   text,
  sent_at      timestamptz,
  sent_by      uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index whatsapp_messages_status_idx on public.whatsapp_messages (status, created_at desc);
create index whatsapp_messages_student_idx on public.whatsapp_messages (student_id, created_at desc);
create index whatsapp_messages_sent_by_idx on public.whatsapp_messages (sent_by);
create trigger whatsapp_messages_set_updated_at before update on public.whatsapp_messages for each row execute function private.set_updated_at();

-- --- gallery: the parent's choice now lives on the child's profile ----------------
create or replace function public.gallery_items(p_limit integer default 60)
returns table (id uuid, first_name text, class_level smallint, course_title text, lesson_title text, kind public.submission_kind, url text, has_image boolean, approved_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and (p.account_status = 'active' or p.role in ('admin', 'content_editor'))
  ) then
    raise exception 'members only' using errcode = '42501';
  end if;
  return query
  select s.id, split_part(btrim(coalesce(p.full_name, 'Student')), ' ', 1), p.class_level, c.title, l.title, s.kind,
         case when s.kind = 'url' then s.url end, s.kind = 'screenshot' and s.storage_path is not null, s.reviewed_at
  from public.external_submissions s
  join public.profiles p on p.id = s.user_id
  join public.courses c on c.id = s.course_id
  join public.lessons l on l.id = s.lesson_id
  where s.status = 'approved' and s.share_in_gallery and s.kind in ('url', 'screenshot') and p.gallery_consent
  order by s.reviewed_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

-- --- grants / RLS -------------------------------------------------------------------
-- Parent contact + consent flags are not editable by the child.
revoke update on public.profiles from authenticated;
grant update (full_name, class_level, locale) on public.profiles to authenticated;

revoke all on public.payment_requests, public.whatsapp_messages from anon, authenticated;
grant select on public.payment_requests, public.whatsapp_messages to authenticated;
grant all on public.payment_requests, public.whatsapp_messages to service_role;
alter table public.payment_requests enable row level security;
alter table public.whatsapp_messages enable row level security;
create policy "payment_requests: own or admin" on public.payment_requests for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_admin()));
create policy "whatsapp: admin" on public.whatsapp_messages for select to authenticated using ((select private.is_admin()));

revoke all on function private.normalize_phone(text) from public;
grant execute on function private.normalize_phone(text) to authenticated, service_role;
