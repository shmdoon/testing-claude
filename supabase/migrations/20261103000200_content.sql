-- =============================================================================
-- Milestone 2 — Content model
-- courses → modules → lessons → lesson_versions (blocks as JSONB)
-- external_tools registry (admin-managed)
--
-- Versioning: each lesson has at most ONE mutable draft version
-- (status='draft'). Publishing copies the draft into a new immutable
-- published version (version = n+1) and points lessons.published_version_id
-- at it. Student progress (M3) references a version id, so students keep the
-- version they started.
-- Block JSON is validated by Zod in the app (src/content/blocks); the DB only
-- enforces that blocks is an array.
-- =============================================================================

create type public.course_type as enum ('mini', 'big');
create type public.content_status as enum ('draft', 'published', 'archived');
create type public.version_status as enum ('draft', 'published');

-- ---------------------------------------------------------------------------
-- external_tools
-- ---------------------------------------------------------------------------
create table public.external_tools (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name               text not null check (char_length(name) between 1 and 80),
  description        text check (char_length(description) <= 500),
  logo_url           text check (logo_url ~ '^(https://|/)'),
  base_url           text not null check (base_url ~ '^https://'),
  -- Hostname patterns accepted for URL submissions, e.g. {'*.netlify.app'}.
  submission_domains text[] not null default '{}',
  min_age            smallint not null default 13 check (min_age between 0 and 21),
  requires_account   boolean not null default true,
  enabled            boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger external_tools_set_updated_at
  before update on public.external_tools
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
create table public.courses (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title            text not null check (char_length(title) between 1 and 120),
  subtitle         text check (char_length(subtitle) <= 200),
  description      text check (char_length(description) <= 5000),
  outcomes         text[] not null default '{}',
  course_type      public.course_type not null default 'mini',
  class_levels     smallint[] not null default '{7,8}',
  subject          text not null default 'ai' check (subject ~ '^[a-z0-9-]+$'),
  cover_image_path text,
  is_free          boolean not null default false,
  price_paise      integer not null default 0,
  status           public.content_status not null default 'draft',
  published_at     timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint courses_price_check check (
    (is_free and price_paise = 0) or (not is_free and price_paise between 100 and 100000000)
  ),
  constraint courses_class_levels_check check (class_levels <@ '{1,2,3,4,5,6,7,8,9,10,11,12}'::smallint[])
);

create index courses_status_idx on public.courses (status);
create index courses_created_by_idx on public.courses (created_by);
create index courses_class_levels_idx on public.courses using gin (class_levels);

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- modules
-- ---------------------------------------------------------------------------
create table public.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 1000),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index modules_course_idx on public.modules (course_id, position);

create trigger modules_set_updated_at
  before update on public.modules
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- lessons
-- ---------------------------------------------------------------------------
create table public.lessons (
  id                     uuid primary key default gen_random_uuid(),
  course_id              uuid not null references public.courses (id) on delete cascade,
  module_id              uuid not null references public.modules (id) on delete cascade,
  slug                   text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title                  text not null check (char_length(title) between 1 and 120),
  summary                text check (char_length(summary) <= 500),
  position               integer not null default 0,
  estimated_minutes      smallint not null default 15 check (estimated_minutes between 1 and 240),
  -- Activity must be attempted before the module unlocks (per-lesson setting).
  require_activity_first boolean not null default true,
  -- Free preview: published content readable without enrollment.
  is_preview             boolean not null default false,
  published_version_id   uuid,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint lessons_slug_per_course unique (course_id, slug)
);

create index lessons_module_idx on public.lessons (module_id, position);
create index lessons_published_version_idx on public.lessons (published_version_id);
-- course_id is covered by the unique (course_id, slug) index.

create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function private.set_updated_at();

-- Keep lessons.course_id consistent with its module.
create or replace function private.lessons_sync_course()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select m.course_id into new.course_id from public.modules m where m.id = new.module_id;
  if new.course_id is null then
    raise exception 'module % not found', new.module_id using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger lessons_sync_course
  before insert or update of module_id on public.lessons
  for each row execute function private.lessons_sync_course();

-- ---------------------------------------------------------------------------
-- lesson_versions
-- ---------------------------------------------------------------------------
create table public.lesson_versions (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  status       public.version_status not null default 'draft',
  version      integer check (version > 0),
  blocks       jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  created_by   uuid references public.profiles (id) on delete set null,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint lesson_versions_published_shape check (
    (status = 'draft' and version is null and published_at is null)
    or (status = 'published' and version is not null and published_at is not null)
  ),
  constraint lesson_versions_unique_version unique (lesson_id, version)
);

create unique index lesson_versions_one_draft on public.lesson_versions (lesson_id) where status = 'draft';
create index lesson_versions_created_by_idx on public.lesson_versions (created_by);
create index lesson_versions_published_by_idx on public.lesson_versions (published_by);

alter table public.lessons
  add constraint lessons_published_version_fkey
  foreign key (published_version_id) references public.lesson_versions (id) on delete set null;

create trigger lesson_versions_set_updated_at
  before update on public.lesson_versions
  for each row execute function private.set_updated_at();

-- Published versions are immutable.
create or replace function private.lesson_versions_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    if tg_op = 'DELETE' then
      -- allowed only as part of deleting the whole lesson (cascade)
      if exists (select 1 from public.lessons where id = old.lesson_id) then
        raise exception 'published lesson versions are immutable' using errcode = '42501';
      end if;
      return old;
    end if;
    raise exception 'published lesson versions are immutable' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger lesson_versions_immutable
  before update or delete on public.lesson_versions
  for each row execute function private.lesson_versions_immutable();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.course_is_published(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.courses c where c.id = p_course_id and c.status = 'published');
$$;

revoke all on function private.course_is_published(uuid) from public;
grant execute on function private.course_is_published(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPCs (staff only, audited)
-- ---------------------------------------------------------------------------

/* Save the lesson draft (creates it if missing). */
create or replace function public.save_lesson_draft(p_lesson_id uuid, p_blocks jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'blocks must be an array' using errcode = '22023';
  end if;
  insert into public.lesson_versions (lesson_id, status, blocks, created_by)
  values (p_lesson_id, 'draft', p_blocks, auth.uid())
  on conflict (lesson_id) where status = 'draft'
  do update set blocks = excluded.blocks
  returning id into v_id;
  return v_id;
end;
$$;

/* Publish the current draft as a new immutable version. */
create or replace function public.publish_lesson(p_lesson_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft   public.lesson_versions;
  v_next    integer;
  v_new_id  uuid;
begin
  if not private.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;

  perform 1 from public.lessons where id = p_lesson_id for update;
  if not found then
    raise exception 'lesson not found' using errcode = 'P0002';
  end if;

  select * into v_draft from public.lesson_versions
  where lesson_id = p_lesson_id and status = 'draft';
  if not found or jsonb_array_length(v_draft.blocks) = 0 then
    raise exception 'nothing to publish' using errcode = '22023';
  end if;

  select coalesce(max(version), 0) + 1 into v_next
  from public.lesson_versions where lesson_id = p_lesson_id and status = 'published';

  insert into public.lesson_versions (lesson_id, status, version, blocks, created_by, published_by, published_at)
  values (p_lesson_id, 'published', v_next, v_draft.blocks, v_draft.created_by, auth.uid(), now())
  returning id into v_new_id;

  update public.lessons set published_version_id = v_new_id where id = p_lesson_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'lesson.published', 'lesson', p_lesson_id::text,
          jsonb_build_object('version', v_next, 'version_id', v_new_id));
  return v_new_id;
end;
$$;

/* Reorder modules of a course: p_ids in the desired order (must be the full set). */
create or replace function public.reorder_modules(p_course_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  if (select count(*) from public.modules where course_id = p_course_id) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from unnest(p_ids) i where not exists
                (select 1 from public.modules m where m.id = i and m.course_id = p_course_id)) then
    raise exception 'ids must be exactly the modules of the course' using errcode = '22023';
  end if;
  update public.modules m set position = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  where m.id = o.id;
end;
$$;

/* Reorder lessons within a module. */
create or replace function public.reorder_lessons(p_module_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  if (select count(*) from public.lessons where module_id = p_module_id) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from unnest(p_ids) i where not exists
                (select 1 from public.lessons l where l.id = i and l.module_id = p_module_id)) then
    raise exception 'ids must be exactly the lessons of the module' using errcode = '22023';
  end if;
  update public.lessons l set position = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  where l.id = o.id;
end;
$$;

/* Publish / unpublish a course (audited). Publishing requires ≥1 published lesson. */
create or replace function public.set_course_status(p_course_id uuid, p_status public.content_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.content_status;
begin
  if not private.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  select status into v_old from public.courses where id = p_course_id for update;
  if not found then
    raise exception 'course not found' using errcode = 'P0002';
  end if;
  if p_status = 'published' and not exists (
    select 1 from public.lessons where course_id = p_course_id and published_version_id is not null
  ) then
    raise exception 'publish at least one lesson first' using errcode = '22023';
  end if;
  update public.courses
     set status = p_status,
         published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end
   where id = p_course_id;
  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'course.status_changed', 'course', p_course_id::text,
          jsonb_build_object('from', v_old, 'to', p_status));
end;
$$;

revoke all on function public.save_lesson_draft(uuid, jsonb) from public, anon;
revoke all on function public.publish_lesson(uuid) from public, anon;
revoke all on function public.reorder_modules(uuid, uuid[]) from public, anon;
revoke all on function public.reorder_lessons(uuid, uuid[]) from public, anon;
revoke all on function public.set_course_status(uuid, public.content_status) from public, anon;
grant execute on function public.save_lesson_draft(uuid, jsonb) to authenticated;
grant execute on function public.publish_lesson(uuid) to authenticated;
grant execute on function public.reorder_modules(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_lessons(uuid, uuid[]) to authenticated;
grant execute on function public.set_course_status(uuid, public.content_status) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on public.external_tools, public.courses, public.modules, public.lessons, public.lesson_versions
  from anon, authenticated;

grant select on public.external_tools, public.courses, public.modules, public.lessons to anon, authenticated;
grant select on public.lesson_versions to authenticated, anon;
grant insert, update, delete on public.external_tools to authenticated;
-- status/published_at change only through set_course_status()
grant insert (slug, title, subtitle, description, outcomes, course_type, class_levels, subject,
              cover_image_path, is_free, price_paise, created_by) on public.courses to authenticated;
grant update (slug, title, subtitle, description, outcomes, course_type, class_levels, subject,
              cover_image_path, is_free, price_paise) on public.courses to authenticated;
grant delete on public.courses to authenticated;
grant insert, update (title, description), delete on public.modules to authenticated;
-- position changes only through reorder_*(); published_version_id only through publish_lesson()
grant insert (module_id, slug, title, summary, position, estimated_minutes, require_activity_first, is_preview)
  on public.lessons to authenticated;
grant update (module_id, slug, title, summary, estimated_minutes, require_activity_first, is_preview)
  on public.lessons to authenticated;
grant delete on public.lessons to authenticated;
-- lesson_versions writes only through save_lesson_draft()/publish_lesson()

grant all on public.external_tools, public.courses, public.modules, public.lessons, public.lesson_versions
  to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.external_tools  enable row level security;
alter table public.courses         enable row level security;
alter table public.modules         enable row level security;
alter table public.lessons         enable row level security;
alter table public.lesson_versions enable row level security;

-- external_tools: readable by everyone (needed to render tasks); admins manage.
create policy "tools: read" on public.external_tools for select to anon, authenticated using (true);
create policy "tools: admin insert" on public.external_tools for insert to authenticated
  with check ((select private.is_admin()));
create policy "tools: admin update" on public.external_tools for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "tools: admin delete" on public.external_tools for delete to authenticated
  using ((select private.is_admin()));

-- courses
create policy "courses: read published" on public.courses for select to anon, authenticated
  using (status = 'published');
create policy "courses: staff read all" on public.courses for select to authenticated
  using ((select private.is_staff()));
create policy "courses: staff insert" on public.courses for insert to authenticated
  with check ((select private.is_staff()) and created_by = (select auth.uid()));
create policy "courses: staff update" on public.courses for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "courses: admin delete" on public.courses for delete to authenticated
  using ((select private.is_admin()));

-- modules
create policy "modules: read published" on public.modules for select to anon, authenticated
  using ((select private.course_is_published(course_id)));
create policy "modules: staff read all" on public.modules for select to authenticated
  using ((select private.is_staff()));
create policy "modules: staff insert" on public.modules for insert to authenticated
  with check ((select private.is_staff()));
create policy "modules: staff update" on public.modules for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "modules: staff delete" on public.modules for delete to authenticated
  using ((select private.is_staff()));

-- lessons (metadata only — content lives in lesson_versions)
create policy "lessons: read published" on public.lessons for select to anon, authenticated
  using (published_version_id is not null and (select private.course_is_published(course_id)));
create policy "lessons: staff read all" on public.lessons for select to authenticated
  using ((select private.is_staff()));
create policy "lessons: staff insert" on public.lessons for insert to authenticated
  with check ((select private.is_staff()));
create policy "lessons: staff update" on public.lessons for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "lessons: staff delete" on public.lessons for delete to authenticated
  using ((select private.is_staff()));

-- lesson_versions: drafts are staff-only. Published content of preview lessons
-- is public; enrolled-student access is added with enrollments (M3/M5).
create policy "versions: staff read" on public.lesson_versions for select to authenticated
  using ((select private.is_staff()));
create policy "versions: preview read" on public.lesson_versions for select to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.lessons l
      where l.published_version_id = lesson_versions.id
        and l.is_preview
        and private.course_is_published(l.course_id)
    )
  );
