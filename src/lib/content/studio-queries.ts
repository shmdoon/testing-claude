import "server-only";
import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { ToolInfo } from "@/content/blocks/previews";

/** Studio reads run as the signed-in editor (RLS: staff see drafts). */
async function staffClient() {
  await requireArea("studio");
  return createClient();
}

export async function listStudioCourses() {
  const supabase = await staffClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, slug, title, course_type, status, is_free, price_paise, updated_at, lessons(count)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getStudioCourse(courseId: string) {
  const supabase = await staffClient();
  const { data, error } = await supabase
    .from("courses")
    .select(
      "*, modules(id, title, description, position, lessons(id, slug, title, position, published_version_id, is_preview, estimated_minutes))",
    )
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const modules = [...data.modules]
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ ...m, lessons: [...m.lessons].sort((a, b) => a.position - b.position) }));
  return { ...data, modules };
}

export async function getStudioLesson(courseId: string, lessonId: string) {
  const supabase = await staffClient();
  const [{ data: lesson, error }, { data: versions }, { data: tools }] = await Promise.all([
    supabase
      .from("lessons")
      .select("*, courses(id, title, slug), modules(id, title)")
      .eq("id", lessonId)
      .eq("course_id", courseId)
      .maybeSingle(),
    supabase
      .from("lesson_versions")
      .select("id, status, version, blocks, published_at, updated_at")
      .eq("lesson_id", lessonId)
      .order("version", { ascending: false, nullsFirst: true }),
    supabase.from("external_tools").select("id, name, base_url, min_age, enabled").order("name"),
  ]);
  if (error) throw error;
  if (!lesson) notFound();
  const draft = versions?.find((v) => v.status === "draft") ?? null;
  const published = (versions ?? []).filter((v) => v.status === "published");
  const current = published.find((v) => v.id === lesson.published_version_id) ?? null;
  return { lesson, draft, published, current, tools: (tools ?? []) as ToolInfo[] };
}
