\set QUIET on
-- Seed content is visible to the public exactly as intended.
select tests.login_anon();
select tests.assert((select count(*) = 2 from public.courses), 'two seeded courses are public');
select tests.assert((select count(*) = 8 from public.lessons), '8 published lessons listed');
select tests.assert((select count(*) = 2 from public.lesson_versions), 'only the 2 preview lessons have readable content');
select tests.assert((select count(*) = 3 from public.external_tools), '3 external tools');
select tests.assert(
  (select count(distinct b ->> 'type') = 16
     from public.lesson_versions v, jsonb_array_elements(v.blocks) b) is not null,
  'query works for anon');
select tests.logout();

select tests.assert(
  (select count(distinct b ->> 'type') = 16 from public.lesson_versions v, jsonb_array_elements(v.blocks) b),
  'seed uses all 16 block types');
select tests.assert(
  (select count(*) = 1 from public.lesson_versions v, jsonb_array_elements(v.blocks) b where b ->> 'type' = 'external_task'),
  'one external task lesson');
