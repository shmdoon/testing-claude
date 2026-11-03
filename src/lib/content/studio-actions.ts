"use server";

import { echoOnError, type FormValues } from "@/lib/forms";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { checkLessonForPublish, lessonBlocksSchema, type LessonIssue } from "@/content/blocks/schema";
import {
  COVER_MAX_BYTES,
  COVER_TYPES,
  courseFormFromData,
  lessonCreateSchema,
  lessonSettingsSchema,
  moduleFormSchema,
  reorderSchema,
} from "@/lib/validation/content";
import { CATALOG_TAG } from "./tags";

export type ActionState = {
  ok?: boolean;
  values?: FormValues;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  issues?: LessonIssue[];
};

/** Every Studio action starts here: server-side role check, never the client. */
async function staff() {
  const user = await requireArea("studio");
  return { user, supabase: await createClient() };
}

function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

function dbError(error: PostgrestError): ActionState {
  if (error.code === "23505") return { fieldErrors: { slug: "That slug is already used." } };
  if (error.code === "42501") return { error: "You don't have permission to do that." };
  if (error.code === "22023") return { error: error.message };
  console.error("studio db error", error);
  return { error: "Something went wrong. Please try again." };
}

function invalidateCatalog() {
  updateTag(CATALOG_TAG);
}

// --- courses -------------------------------------------------------------------

export async function createCourse(_prev: ActionState, form: FormData): Promise<ActionState> {
  return echoOnError<ActionState>(form, async () => {
    const { user, supabase } = await staff();
    const parsed = courseFormFromData(form);
    if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };

    const { data, error } = await supabase
      .from("courses")
      .insert({ ...parsed.data, created_by: user.id })
      .select("id")
      .single();
    if (error) return dbError(error);

    // Mini courses get a single implicit module so editors can add lessons straight away.
    if (parsed.data.course_type === "mini") {
      await supabase.from("modules").insert({ course_id: data.id, title: "Lessons", position: 1 });
    }
    redirect(`/studio/courses/${data.id}`);
  });
}

export async function updateCourse(courseId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return echoOnError<ActionState>(form, async () => {
    const { supabase } = await staff();
    const parsed = courseFormFromData(form);
    if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
    const { error } = await supabase.from("courses").update(parsed.data).eq("id", courseId);
    if (error) return dbError(error);
    invalidateCatalog();
    return { ok: true, message: "Saved." };
  });
}

export async function setCourseStatus(courseId: string, status: "draft" | "published" | "archived"): Promise<ActionState> {
  const { supabase } = await staff();
  const { error } = await supabase.rpc("set_course_status", { p_course_id: courseId, p_status: status });
  if (error) return dbError(error);
  invalidateCatalog();
  return { ok: true, message: status === "published" ? "Course published." : "Course unpublished." };
}

export async function deleteCourse(courseId: string): Promise<ActionState> {
  const { user, supabase } = await staff();
  if (user.profile.role !== "admin") return { error: "Only admins can delete courses." };
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) return dbError(error);
  invalidateCatalog();
  redirect("/studio");
}

export async function uploadCourseCover(courseId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await staff();
  const file = form.get("cover");
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { cover: "Choose an image." } };
  if (!(COVER_TYPES as readonly string[]).includes(file.type)) return { fieldErrors: { cover: "Use PNG, JPEG or WebP." } };
  if (file.size > COVER_MAX_BYTES) return { fieldErrors: { cover: "Max 2 MB." } };

  const ext = file.type.split("/")[1]!.replace("jpeg", "jpg");
  const objectPath = `covers/${courseId}/${randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("course-media")
    .upload(objectPath, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (upErr) {
    console.error("cover upload failed", upErr);
    return { error: "Upload failed. Please try again." };
  }
  const { error } = await supabase
    .from("courses")
    .update({ cover_image_path: `course-media/${objectPath}` })
    .eq("id", courseId);
  if (error) return dbError(error);
  invalidateCatalog();
  return { ok: true, message: "Cover updated." };
}

// --- modules -------------------------------------------------------------------

export async function addModule(courseId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return echoOnError<ActionState>(form, async () => {
    const { supabase } = await staff();
    const parsed = moduleFormSchema.safeParse({ title: form.get("title") ?? "", description: form.get("description") ?? "" });
    if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
    const { count } = await supabase.from("modules").select("id", { count: "exact", head: true }).eq("course_id", courseId);
    const { error } = await supabase.from("modules").insert({ ...parsed.data, course_id: courseId, position: (count ?? 0) + 1 });
    if (error) return dbError(error);
    invalidateCatalog();
    return { ok: true };
  });
}

export async function renameModule(moduleId: string, title: string): Promise<ActionState> {
  const { supabase } = await staff();
  const parsed = moduleFormSchema.pick({ title: true }).safeParse({ title });
  if (!parsed.success) return { error: "Module title is required." };
  const { error } = await supabase.from("modules").update(parsed.data).eq("id", moduleId);
  if (error) return dbError(error);
  invalidateCatalog();
  return { ok: true };
}

export async function deleteModule(moduleId: string): Promise<ActionState> {
  const { supabase } = await staff();
  const { count } = await supabase.from("lessons").select("id", { count: "exact", head: true }).eq("module_id", moduleId);
  if (count) return { error: "Move or delete the lessons in this module first." };
  const { error } = await supabase.from("modules").delete().eq("id", moduleId);
  if (error) return dbError(error);
  invalidateCatalog();
  return { ok: true };
}

export async function reorderModules(courseId: string, ids: string[]): Promise<ActionState> {
  const { supabase } = await staff();
  const parsed = reorderSchema.safeParse({ parent_id: courseId, ids });
  if (!parsed.success) return { error: "Invalid order." };
  const { error } = await supabase.rpc("reorder_modules", { p_course_id: courseId, p_ids: parsed.data.ids });
  if (error) return dbError(error);
  invalidateCatalog();
  return { ok: true };
}

// --- lessons -------------------------------------------------------------------

export async function addLesson(courseId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return echoOnError<ActionState>(form, async () => {
    const { supabase } = await staff();
    const parsed = lessonCreateSchema.safeParse({
      module_id: form.get("module_id"),
      title: form.get("title") ?? "",
      slug: form.get("slug") ?? "",
    });
    if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
    const { count } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("module_id", parsed.data.module_id);
    const { data, error } = await supabase
      .from("lessons")
      .insert({ ...parsed.data, course_id: courseId, position: (count ?? 0) + 1 })
      .select("id")
      .single();
    if (error) return dbError(error);
    redirect(`/studio/courses/${courseId}/lessons/${data.id}`);
  });
}

export async function updateLessonSettings(lessonId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return echoOnError<ActionState>(form, async () => {
    const { supabase } = await staff();
    const parsed = lessonSettingsSchema.safeParse({
      title: form.get("title") ?? "",
      slug: form.get("slug") ?? "",
      summary: form.get("summary") ?? "",
      estimated_minutes: form.get("estimated_minutes"),
      require_activity_first: form.get("require_activity_first") === "on",
      is_preview: form.get("is_preview") === "on",
    });
    if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error.issues) };
    const { error } = await supabase.from("lessons").update(parsed.data).eq("id", lessonId);
    if (error) return dbError(error);
    invalidateCatalog();
    return { ok: true, message: "Saved." };
  });
}

export async function deleteLesson(courseId: string, lessonId: string): Promise<ActionState> {
  const { supabase } = await staff();
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) return dbError(error);
  invalidateCatalog();
  redirect(`/studio/courses/${courseId}`);
}

export async function reorderLessons(moduleId: string, ids: string[]): Promise<ActionState> {
  const { supabase } = await staff();
  const parsed = reorderSchema.safeParse({ parent_id: moduleId, ids });
  if (!parsed.success) return { error: "Invalid order." };
  const { error } = await supabase.rpc("reorder_lessons", { p_module_id: moduleId, p_ids: parsed.data.ids });
  if (error) return dbError(error);
  invalidateCatalog();
  return { ok: true };
}

/** Save the draft. Structural problems are rejected; pedagogy warnings are reported. */
export async function saveLessonDraft(lessonId: string, blocks: unknown): Promise<ActionState> {
  const { supabase } = await staff();
  const parsed = lessonBlocksSchema.safeParse(blocks);
  if (!parsed.success) {
    return {
      error: "Fix the highlighted blocks before saving.",
      issues: parsed.error.issues.map((i) => ({
        level: "error",
        message: i.message,
        path: i.path.filter((p): p is string | number => typeof p !== "symbol"),
      })),
    };
  }
  const { error } = await supabase.rpc("save_lesson_draft", { p_lesson_id: lessonId, p_blocks: parsed.data });
  if (error) return dbError(error);
  return { ok: true, message: "Draft saved.", issues: checkLessonForPublish(parsed.data).issues };
}

/** Save + publish as a new immutable version. */
export async function publishLesson(lessonId: string, blocks: unknown): Promise<ActionState> {
  const check = checkLessonForPublish(blocks);
  if (!check.ok) return { error: "This lesson can't be published yet.", issues: check.issues };
  const saved = await saveLessonDraft(lessonId, check.blocks);
  if (!saved.ok) return saved;
  const { supabase } = await staff();
  const { error } = await supabase.rpc("publish_lesson", { p_lesson_id: lessonId });
  if (error) return dbError(error);
  invalidateCatalog();
  return { ok: true, message: "Published as a new version.", issues: check.issues };
}
