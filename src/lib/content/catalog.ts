import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import type { ToolInfo } from "@/content/blocks/previews";
import { CATALOG_TAG } from "./tags";

/**
 * Public catalogue reads. They use a cookie-less anon client so results can be
 * cached and shared (RLS: published content only). Invalidated by
 * updateTag(CATALOG_TAG) from Studio/admin actions.
 */
function anonClient() {
  const env = getPublicEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const COURSE_CARD = "id, slug, title, subtitle, course_type, class_levels, subject, cover_image_path, is_free, price_paise, published_at, lessons(count)";

export type CatalogCourse = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  course_type: "mini" | "big";
  class_levels: number[];
  subject: string;
  cover_image_path: string | null;
  is_free: boolean;
  price_paise: number;
  lesson_count: number;
};

export async function getPublishedCourses(): Promise<CatalogCourse[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  const { data, error } = await anonClient()
    .from("courses")
    .select(COURSE_CARD)
    .eq("status", "published")
    .order("published_at", { ascending: true });
  if (error || !data) {
    console.error("catalog fetch failed", error?.message);
    cacheLife("seconds"); // don't keep a failure around
    return [];
  }
  cacheLife("hours");
  return data.map(({ lessons, ...c }) => ({ ...c, lesson_count: lessons[0]?.count ?? 0 }));
}

export type CourseDetail = NonNullable<Awaited<ReturnType<typeof getCourseBySlug>>>;

export async function getCourseBySlug(slug: string) {
  "use cache";
  cacheTag(CATALOG_TAG);
  const supabase = anonClient();
  const { data: course, error } = await supabase
    .from("courses")
    .select(
      "id, slug, title, subtitle, description, outcomes, course_type, class_levels, subject, cover_image_path, is_free, price_paise, modules(id, title, description, position, lessons(id, slug, title, summary, position, estimated_minutes, is_preview, published_version_id))",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    console.error("course fetch failed", error.message);
    cacheLife("seconds");
    return null;
  }
  if (!course) {
    cacheLife("minutes");
    return null;
  }

  const modules = [...course.modules]
    .sort((a, b) => a.position - b.position)
    .map((m) => ({ ...m, lessons: [...m.lessons].sort((a, b) => a.position - b.position) }));

  // Preview: activity blocks of the first free-preview lesson (readable by anon via RLS).
  const previewLesson = modules.flatMap((m) => m.lessons).find((l) => l.is_preview && l.published_version_id);
  let preview: { lessonTitle: string; blocks: unknown[] } | null = null;
  if (previewLesson?.published_version_id) {
    const { data: v } = await supabase.from("lesson_versions").select("blocks").eq("id", previewLesson.published_version_id).maybeSingle();
    const blocks = Array.isArray(v?.blocks) ? (v.blocks as { phase?: string }[]) : [];
    preview = { lessonTitle: previewLesson.title, blocks: blocks.filter((b) => b.phase === "activity") };
  }

  const { data: tools } = await supabase.from("external_tools").select("id, name, base_url, min_age, enabled");
  cacheLife("hours");
  return { ...course, modules, preview, tools: (tools ?? []) as ToolInfo[] };
}
