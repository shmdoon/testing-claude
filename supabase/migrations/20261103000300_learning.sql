-- =============================================================================
-- Milestone 3 — Learning data
-- enrollments, lesson_progress, block_responses, external_submissions,
-- learning_events. Students/parents/staff READ via RLS; every WRITE goes
-- through server code with the service role after access checks (scores and
-- completion can't be forged from the browser), or through staff RPCs.
-- =============================================================================

create type public.enrollment_source as enum ('free', 'purchase', 'admin');
create type public.enrollment_status as enum ('active', 'revoked');
create type public.progress_status as enum ('in_progress', 'awaiting_review', 'completed');
create type public.submission_kind as enum ('url', 'screenshot', 'file', 'text');
create type public.submission_status as enum ('submitted', 'approved', 'needs_revision');

-- ---------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------
create table public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  source      public.enrollment_source not null,
  status      public.enrollment_status not null default 'active',
  order_id    uuid, -- FK added with orders (M5)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint enrollments_unique unique (user_id, course_id)
);
create index enrollments_course_idx on public.enrollments (course_id);
create index enrollments_order_idx on public.enrollments (order_id);
create trigger enrollments_set_updated_at before update on public.enrollments
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- lesson_progress — one row per student per lesson, pinned to a version
-- ---------------------------------------------------------------------------
create table public.lesson_progress (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles (id) on delete cascade,
  course_id             uuid not null references public.courses (id) on delete cascade,
  lesson_id             uuid not null references public.lessons (id) on delete cascade,
  lesson_version_id     uuid not null references public.lesson_versions (id) on delete cascade,
  status                public.progress_status not null default 'in_progress',
  current_phase         text not null default 'activity' check (current_phase in ('activity', 'reflection', 'module', 'check', 'done')),
  activity_attempted_at timestamptz,
  quiz_score            smallint check (quiz_score between 0 and 100),
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  last_activity_at      timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint lesson_progress_unique unique (user_id, lesson_id)
);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);
create index lesson_progress_version_idx on public.lesson_progress (lesson_version_id);
create index lesson_progress_course_user_idx on public.lesson_progress (course_id, user_id);
create index lesson_progress_user_recent_idx on public.lesson_progress (user_id, last_activity_at desc);
create trigger lesson_progress_set_updated_at before update on public.lesson_progress
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- block_responses — latest response per block (attempts counted, not stored)
-- ---------------------------------------------------------------------------
create table public.block_responses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  lesson_id         uuid not null references public.lessons (id) on delete cascade,
  lesson_version_id uuid not null references public.lesson_versions (id) on delete cascade,
  block_id          text not null check (char_length(block_id) <= 40),
  block_type        text not null check (char_length(block_type) <= 40),
  response          jsonb not null default '{}'::jsonb check (pg_column_size(response) <= 16384),
  score             smallint check (score between 0 and 100),
  attempts          integer not null default 1 check (attempts >= 1),
  completed         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint block_responses_unique unique (user_id, lesson_version_id, block_id)
);
create index block_responses_lesson_idx on public.block_responses (lesson_id);
create index block_responses_version_idx on public.block_responses (lesson_version_id);
create trigger block_responses_set_updated_at before update on public.block_responses
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- external_submissions — work done on external tools
-- ---------------------------------------------------------------------------
create table public.external_submissions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  course_id         uuid not null references public.courses (id) on delete cascade,
  lesson_id         uuid not null references public.lessons (id) on delete cascade,
  lesson_version_id uuid not null references public.lesson_versions (id) on delete cascade,
  block_id          text not null check (char_length(block_id) <= 40),
  tool_id           uuid references public.external_tools (id) on delete set null,
  kind              public.submission_kind not null,
  url               text check (url is null or (url ~ '^https://' and char_length(url) <= 2000)),
  text_answer       text check (char_length(text_answer) <= 5000),
  storage_path      text check (storage_path is null or storage_path ~ '^[0-9a-f-]{36}/'),
  url_check         jsonb,
  status            public.submission_status not null default 'submitted',
  feedback          text check (char_length(feedback) <= 2000),
  reviewed_by       uuid references public.profiles (id) on delete set null,
  reviewed_at       timestamptz,
  share_in_gallery  boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint external_submissions_payload check (
    (kind = 'url' and url is not null)
    or (kind = 'text' and text_answer is not null)
    or (kind in ('screenshot', 'file') and storage_path is not null)
  )
);
create index external_submissions_user_idx on public.external_submissions (user_id, lesson_id);
create index external_submissions_course_idx on public.external_submissions (course_id);
create index external_submissions_lesson_idx on public.external_submissions (lesson_id);
create index external_submissions_version_idx on public.external_submissions (lesson_version_id);
create index external_submissions_tool_idx on public.external_submissions (tool_id);
create index external_submissions_reviewer_idx on public.external_submissions (reviewed_by);
create index external_submissions_queue_idx on public.external_submissions (status, created_at);
create trigger external_submissions_set_updated_at before update on public.external_submissions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- learning_events — discrete, append-only learning events
-- ---------------------------------------------------------------------------
create table public.learning_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  course_id         uuid references public.courses (id) on delete cascade,
  lesson_id         uuid references public.lessons (id) on delete cascade,
  lesson_version_id uuid references public.lesson_versions (id) on delete set null,
  block_id          text check (char_length(block_id) <= 40),
  event_type        text not null check (event_type in (
                      'lesson_started', 'activity_attempted', 'activity_completed', 'reflection_saved',
                      'quiz_submitted', 'lesson_completed', 'external_task_started',
                      'external_task_returned', 'external_submission_created', 'external_submission_reviewed')),
  score             smallint check (score between 0 and 100),
  metadata          jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 4096),
  occurred_at       timestamptz not null default now()
);
create index learning_events_user_time_idx on public.learning_events (user_id, occurred_at desc);
create index learning_events_course_idx on public.learning_events (course_id, occurred_at desc);
create index learning_events_lesson_idx on public.learning_events (lesson_id, event_type);
create index learning_events_version_idx on public.learning_events (lesson_version_id);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
create or replace function private.is_enrolled(p_user_id uuid, p_course_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments e
    where e.user_id = p_user_id and e.course_id = p_course_id and e.status = 'active'
  );
$$;

/* Can this user open this lesson in the player? (active account + enrolled/preview/staff) */
create or replace function private.can_access_lesson(p_user_id uuid, p_lesson_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.lessons l
    join public.courses c on c.id = l.course_id
    join public.profiles p on p.id = p_user_id
    where l.id = p_lesson_id
      and (
        p.role in ('admin', 'content_editor')
        or (
          p.account_status = 'active'
          and c.status = 'published'
          and l.published_version_id is not null
          and (l.is_preview or private.is_enrolled(p_user_id, c.id))
        )
      )
  );
$$;

revoke all on function private.is_enrolled(uuid, uuid) from public;
revoke all on function private.can_access_lesson(uuid, uuid) from public;
grant execute on function private.is_enrolled(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_access_lesson(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Completion: a lesson is complete when every interactive block is complete;
-- "awaiting_review" when only external submissions are pending review.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_lesson_progress(p_user_id uuid, p_lesson_id uuid)
returns public.progress_status
language plpgsql security definer set search_path = '' as $$
declare
  v_prog     public.lesson_progress;
  v_blocks   jsonb;
  v_total    int;
  v_done     int;
  v_pending  int;
  v_status   public.progress_status;
begin
  select * into v_prog from public.lesson_progress
  where user_id = p_user_id and lesson_id = p_lesson_id for update;
  if not found then return null; end if;

  select blocks into v_blocks from public.lesson_versions where id = v_prog.lesson_version_id;

  with interactive as (
    select b ->> 'id' as id, b ->> 'type' as type
    from jsonb_array_elements(v_blocks) b
    where b ->> 'type' in ('drag_sort', 'match_pairs', 'fill_blank', 'predict_then_reveal',
                           'multiple_choice_explore', 'embed_sim', 'upload_work', 'checklist_task',
                           'external_task', 'reflection_prompt', 'quiz')
  )
  select count(*),
         count(*) filter (where r.completed),
         count(*) filter (where not coalesce(r.completed, false) and i.type = 'external_task'
                          and exists (select 1 from public.external_submissions s
                                      where s.user_id = p_user_id and s.lesson_version_id = v_prog.lesson_version_id
                                        and s.block_id = i.id and s.status = 'submitted'))
    into v_total, v_done, v_pending
  from interactive i
  left join public.block_responses r
    on r.user_id = p_user_id and r.lesson_version_id = v_prog.lesson_version_id and r.block_id = i.id;

  v_status := case
    when v_done = v_total then 'completed'
    when v_done + v_pending = v_total then 'awaiting_review'
    else 'in_progress'
  end;

  update public.lesson_progress
     set status = v_status,
         completed_at = case when v_status = 'completed' then coalesce(completed_at, now()) else null end,
         current_phase = case when v_status = 'completed' then 'done' else current_phase end,
         last_activity_at = now()
   where id = v_prog.id;

  if v_status = 'completed' and v_prog.status <> 'completed' then
    insert into public.learning_events (user_id, course_id, lesson_id, lesson_version_id, event_type, score)
    values (p_user_id, v_prog.course_id, p_lesson_id, v_prog.lesson_version_id, 'lesson_completed', v_prog.quiz_score);
  end if;
  return v_status;
end;
$$;

revoke all on function public.recompute_lesson_progress(uuid, uuid) from public, anon, authenticated;
grant execute on function public.recompute_lesson_progress(uuid, uuid) to service_role;

/* Staff review of an external submission. Approval completes the block. */
create or replace function public.review_submission(p_submission_id uuid, p_status public.submission_status, p_feedback text)
returns public.progress_status
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.external_submissions;
begin
  if not private.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  if p_status = 'submitted' then
    raise exception 'choose approved or needs_revision' using errcode = '22023';
  end if;
  if p_status = 'needs_revision' and char_length(btrim(coalesce(p_feedback, ''))) = 0 then
    raise exception 'feedback is required when asking for a revision' using errcode = '22023';
  end if;

  update public.external_submissions
     set status = p_status, feedback = nullif(btrim(p_feedback), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_submission_id
  returning * into v_sub;
  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;

  insert into public.block_responses (user_id, lesson_id, lesson_version_id, block_id, block_type, response, completed)
  values (v_sub.user_id, v_sub.lesson_id, v_sub.lesson_version_id, v_sub.block_id, 'external_task',
          jsonb_build_object('submission_id', v_sub.id, 'status', p_status), p_status = 'approved')
  on conflict (user_id, lesson_version_id, block_id) do update
    set completed = excluded.completed, response = excluded.response;

  insert into public.learning_events (user_id, course_id, lesson_id, lesson_version_id, block_id, event_type, metadata)
  values (v_sub.user_id, v_sub.course_id, v_sub.lesson_id, v_sub.lesson_version_id, v_sub.block_id,
          'external_submission_reviewed', jsonb_build_object('status', p_status, 'reviewer', auth.uid()));

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'submission.reviewed', 'external_submission', v_sub.id::text, jsonb_build_object('status', p_status));

  return public.recompute_lesson_progress(v_sub.user_id, v_sub.lesson_id);
end;
$$;

revoke all on function public.review_submission(uuid, public.submission_status, text) from public, anon;
grant execute on function public.review_submission(uuid, public.submission_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants: read-only for clients; writes via service role / RPC.
-- ---------------------------------------------------------------------------
revoke all on public.enrollments, public.lesson_progress, public.block_responses,
              public.external_submissions, public.learning_events from anon, authenticated;
grant select on public.enrollments, public.lesson_progress, public.block_responses,
                public.external_submissions, public.learning_events to authenticated;
grant all on public.enrollments, public.lesson_progress, public.block_responses,
             public.external_submissions, public.learning_events to service_role;

alter table public.enrollments          enable row level security;
alter table public.lesson_progress      enable row level security;
alter table public.block_responses      enable row level security;
alter table public.external_submissions enable row level security;
alter table public.learning_events      enable row level security;

-- Same three readers on every learning table: the student, their linked parents, admins.
-- Staff (content editors) additionally read submissions to review them.
create policy "enrollments: read" on public.enrollments for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_parent_of(user_id)) or (select private.is_admin()));
create policy "progress: read" on public.lesson_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_parent_of(user_id)) or (select private.is_admin()));
create policy "responses: read" on public.block_responses for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_parent_of(user_id)) or (select private.is_admin()));
create policy "submissions: read" on public.external_submissions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_parent_of(user_id)) or (select private.is_staff()));
create policy "events: read" on public.learning_events for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_parent_of(user_id)) or (select private.is_admin()));

-- Enrolled students (with an active account) can read the published versions
-- of their courses: the current one, and any older one they already started.
create policy "versions: enrolled read" on public.lesson_versions for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.lessons l
      join public.profiles p on p.id = (select auth.uid())
      where l.id = lesson_versions.lesson_id
        and p.account_status = 'active'
        and private.is_enrolled(p.id, l.course_id)
        and (
          l.published_version_id = lesson_versions.id
          or exists (select 1 from public.lesson_progress lp
                     where lp.user_id = p.id and lp.lesson_version_id = lesson_versions.id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Private bucket for student work (photos, files). No client policies:
-- uploads and short-lived signed URLs are created by the server only.
-- ---------------------------------------------------------------------------
do $migration$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not present; skipping submissions bucket';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('submissions', 'submissions', false, 5242880,
          array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
  on conflict (id) do update
    set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
end;
$migration$;
