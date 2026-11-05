-- =============================================================================
-- Milestone 7 — data rights (DPDP Act 2023: erasure, access) + legal settings.
-- * deletion_requests: a student (or an admin on the parent's behalf) asks;
--   an admin confirms; the row outlives the erasure as the audit record.
-- * erase_student(): removes learning data, messages and contact details and
--   anonymises the profile. Orders/invoices are kept (GST law requires
--   invoices to be retained) — the auth user is deleted by the app when the
--   student has no orders, otherwise anonymised + banned.
-- =============================================================================

alter type public.account_status add value if not exists 'deleted';

create type public.deletion_status as enum ('pending', 'completed', 'cancelled');

create table public.deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  -- null once the profile is gone; subject_id keeps the (non-identifying) id for audit.
  student_id    uuid references public.profiles (id) on delete set null,
  subject_id    uuid not null,
  source        text not null check (source in ('student', 'admin', 'auto')),
  note          text check (char_length(note) <= 500),
  requested_by  uuid references public.profiles (id) on delete set null,
  status        public.deletion_status not null default 'pending',
  completed_at  timestamptz,
  completed_by  uuid references public.profiles (id) on delete set null,
  cancelled_at  timestamptz,
  outcome       jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index deletion_requests_one_pending on public.deletion_requests (subject_id) where status = 'pending';
create index deletion_requests_status_idx on public.deletion_requests (status, created_at desc);
create index deletion_requests_student_idx on public.deletion_requests (student_id);
create index deletion_requests_requested_by_idx on public.deletion_requests (requested_by);
create index deletion_requests_completed_by_idx on public.deletion_requests (completed_by);
create trigger deletion_requests_set_updated_at before update on public.deletion_requests
  for each row execute function private.set_updated_at();

alter table public.deletion_requests enable row level security;
revoke all on public.deletion_requests from anon, authenticated;
grant select on public.deletion_requests to authenticated;
grant all on public.deletion_requests to service_role;
-- Writes go through server actions (service role) after checks.
create policy "deletion_requests: own or admin" on public.deletion_requests for select to authenticated
  using (student_id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- erase_student — service role only. Idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.erase_student(p_student uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_p public.profiles;
  v_orders boolean;
  v_counts jsonb := '{}'::jsonb;
  v_n int;
begin
  select * into v_p from public.profiles where id = p_student for update;
  if not found then raise exception 'profile not found' using errcode = 'P0002'; end if;
  if v_p.role not in ('student', 'parent') then
    raise exception 'only student accounts can be erased here' using errcode = '42501';
  end if;

  v_orders := exists (select 1 from public.orders where student_id = p_student or buyer_id = p_student);

  delete from public.block_responses where user_id = p_student;        get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('block_responses', v_n);
  delete from public.lesson_progress where user_id = p_student;        get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('lesson_progress', v_n);
  delete from public.learning_events where user_id = p_student;        get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('learning_events', v_n);
  delete from public.activity_minutes where user_id = p_student;       get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('activity_minutes', v_n);
  delete from public.external_task_minutes where user_id = p_student;  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('external_task_minutes', v_n);
  delete from public.activity_state where user_id = p_student;
  delete from public.external_submissions where user_id = p_student;   get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('external_submissions', v_n);
  delete from public.enrollments where user_id = p_student;            get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('enrollments', v_n);
  delete from public.payment_requests where student_id = p_student;
  delete from public.whatsapp_messages where student_id = p_student;   get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('whatsapp_messages', v_n);
  delete from public.parent_student_links where student_id = p_student or parent_id = p_student;
  delete from public.email_log where to_email = v_p.email or (v_p.parent_email is not null and to_email = v_p.parent_email);
  delete from public.rate_limits where key like '%' || v_p.email;

  -- Keep proof that consent was given (date, method, policy version), drop contact details.
  update public.consents set parent_email = null, parent_phone = null, token_hash = null, token_expires_at = null
   where student_id = p_student;

  update public.profiles
     set full_name = null, class_level = null, parent_email = null, parent_name = null, parent_phone = null,
         parent_whatsapp_opt_in = false, gallery_consent = false, acquisition = null,
         account_status = 'deleted'
   where id = p_student;

  return jsonb_build_object('has_orders', v_orders, 'deleted', v_counts);
end;
$$;
revoke all on function public.erase_student(uuid) from public, anon, authenticated;
grant execute on function public.erase_student(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Legal settings (shown on the legal pages; admins edit in /admin/settings).
-- ---------------------------------------------------------------------------
insert into public.settings (key, value, description) values
  ('legal.grievance_officer', '"Name of grievance officer (placeholder)"', 'Grievance officer named in the privacy policy (DPDP Act)'),
  ('legal.grievance_email', '"privacy@example.com"', 'Email for privacy requests and grievances'),
  ('legal.last_updated', '"2026-11-05"', 'Date shown as "last updated" on the legal pages'),
  ('legal.reviewed', 'false', 'Set to true once a lawyer has reviewed the legal pages (removes the draft banner)')
on conflict (key) do nothing;
