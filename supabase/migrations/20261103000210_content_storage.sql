-- Storage for course media (cover images, step screenshots, tool logos).
-- Public-read bucket: only staff can write. Skipped on plain Postgres (tests).
do $migration$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not present; skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('course-media', 'course-media', true, 2097152,
          array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute $p$drop policy if exists "course-media: staff insert" on storage.objects$p$;
  execute $p$drop policy if exists "course-media: staff update" on storage.objects$p$;
  execute $p$drop policy if exists "course-media: staff delete" on storage.objects$p$;
  execute $p$create policy "course-media: staff insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'course-media' and (select private.is_staff()))$p$;
  execute $p$create policy "course-media: staff update" on storage.objects for update to authenticated
    using (bucket_id = 'course-media' and (select private.is_staff()))$p$;
  execute $p$create policy "course-media: staff delete" on storage.objects for delete to authenticated
    using (bucket_id = 'course-media' and (select private.is_staff()))$p$;
end;
$migration$;
