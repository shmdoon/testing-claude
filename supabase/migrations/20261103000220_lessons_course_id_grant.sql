-- Let editors pass lessons.course_id on insert (generated types require it).
-- The lessons_sync_course trigger always overwrites it from the module, so a
-- wrong value can't attach a lesson to a different course.
grant insert (course_id) on public.lessons to authenticated;
