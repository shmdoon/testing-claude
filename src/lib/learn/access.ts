import "server-only";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { lessonBlocksSchema, type Block } from "@/content/blocks/schema";
import type { CurrentUser } from "@/lib/auth/dal";

export const isStaff = (role: string) => role === "admin" || role === "content_editor";

export type LessonAccess =
  | { ok: true }
  | { ok: false; reason: "pending_consent" | "not_enrolled" | "unavailable" };

/** Mirrors private.can_access_lesson() for a friendly explanation in the UI. */
export async function checkLessonAccess(
  user: CurrentUser,
  lesson: { id: string; course_id: string; is_preview: boolean; published_version_id: string | null },
  courseStatus: string,
): Promise<LessonAccess> {
  if (isStaff(user.profile.role)) return { ok: true };
  if (courseStatus !== "published" || !lesson.published_version_id) return { ok: false, reason: "unavailable" };
  if (user.profile.account_status !== "active") return { ok: false, reason: "pending_consent" };
  if (lesson.is_preview) return { ok: true };
  const { data } = await createAdminClient()
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", lesson.course_id)
    .eq("status", "active")
    .maybeSingle();
  return data ? { ok: true } : { ok: false, reason: "not_enrolled" };
}

/**
 * Server-trusted context for a write: the student's progress row (pinned
 * version) and that version's validated blocks. Never trusts ids from the
 * browser beyond looking them up.
 */
export async function loadWriteContext(user: CurrentUser, lessonId: string) {
  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id, course_id, is_preview, published_version_id, require_activity_first, courses(status)")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) notFound();
  const access = await checkLessonAccess(user, lesson, lesson.courses?.status ?? "draft");
  if (!access.ok) throw new Error(`No access: ${access.reason}`);

  const { data: progress } = await admin
    .from("lesson_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (!progress) throw new Error("Lesson not started");

  const { data: version } = await admin.from("lesson_versions").select("blocks").eq("id", progress.lesson_version_id).single();
  const parsed = lessonBlocksSchema.safeParse(version?.blocks);
  const blocks: Block[] = parsed.success ? parsed.data : [];
  return { admin, lesson, progress, blocks };
}
