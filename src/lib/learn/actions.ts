"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireArea } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { sniffType, stripImageMetadata, UnsafeImageError, type SafeType } from "@/lib/security/image";
import { checkUrl } from "@/lib/security/url-check";
import { gradeBlock, isGradable, type GradeResult } from "@/content/blocks/grading";
import { PHASES, type Block, type BlockOf } from "@/content/blocks/schema";
import { canUseTool, capAwaySeconds } from "./age";
import { isStaff, loadWriteContext } from "./access";
import type { LessonStatus } from "./queries";

export type SubmitResult =
  | { ok: true; result: GradeResult; lessonStatus: LessonStatus; activityAttempted: boolean }
  | { ok: false; error: string };

const uuid = z.uuid();
const blockId = z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/);
const SUBMISSIONS_BUCKET = process.env.SUPABASE_SUBMISSIONS_BUCKET || "submissions";
const MAX_UPLOAD = 5 * 1024 * 1024;

async function student() {
  return requireArea("learn");
}

async function limited(userId: string, kind: string, limit: number) {
  return !(await rateLimit(`learn:${kind}:${userId}`, limit, 60));
}

function findBlock<T extends Block["type"]>(blocks: Block[], id: string, type?: T) {
  const b = blocks.find((x) => x.id === id);
  if (!b || (type && b.type !== type)) return null;
  return b as T extends Block["type"] ? BlockOf<T> : Block;
}

async function recompute(admin: ReturnType<typeof createAdminClient>, userId: string, lessonId: string): Promise<LessonStatus> {
  const { data } = await admin.rpc("recompute_lesson_progress", { p_user_id: userId, p_lesson_id: lessonId });
  return (data as LessonStatus | null) ?? "in_progress";
}

// ---------------------------------------------------------------------------
// Enrolment (free courses)
// ---------------------------------------------------------------------------
export async function enrollFree(courseId: string): Promise<{ error?: string }> {
  const user = await student();
  if (!uuid.safeParse(courseId).success) return { error: "Unknown course." };
  if (!isStaff(user.profile.role) && user.profile.account_status !== "active") {
    return { error: "Your parent or guardian needs to approve your account first." };
  }
  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("id, slug, is_free, status").eq("id", courseId).maybeSingle();
  if (!course || course.status !== "published") return { error: "This course isn't available." };
  if (!course.is_free) return { error: "This course needs to be purchased." };
  const { error } = await admin
    .from("enrollments")
    .upsert({ user_id: user.id, course_id: course.id, source: "free", status: "active" }, { onConflict: "user_id,course_id", ignoreDuplicates: true });
  if (error) {
    console.error("enrol failed", error);
    return { error: "Couldn't enrol you. Please try again." };
  }
  redirect(`/learn/${course.slug}`);
}

// ---------------------------------------------------------------------------
// Interactive blocks
// ---------------------------------------------------------------------------
export async function submitBlock(lessonId: string, id: string, response: unknown): Promise<SubmitResult> {
  const user = await student();
  if (!uuid.safeParse(lessonId).success || !blockId.safeParse(id).success) return { ok: false, error: "Invalid request." };
  if (await limited(user.id, "submit", 60)) return { ok: false, error: "Slow down a little and try again." };

  const { admin, lesson, progress, blocks } = await loadWriteContext(user, lessonId);
  const block = findBlock(blocks, id);
  if (!block || !isGradable(block.type)) return { ok: false, error: "Unknown block." };
  const graded = gradeBlock(block, response);
  if (!graded.ok) return { ok: false, error: graded.error };

  const { data: existing } = await admin
    .from("block_responses")
    .select("attempts, completed")
    .eq("user_id", user.id)
    .eq("lesson_version_id", progress.lesson_version_id)
    .eq("block_id", block.id)
    .maybeSingle();

  const { error } = await admin.from("block_responses").upsert(
    {
      user_id: user.id,
      lesson_id: lesson.id,
      lesson_version_id: progress.lesson_version_id,
      block_id: block.id,
      block_type: block.type,
      response: graded.response as never,
      score: graded.result.score,
      completed: graded.result.completed || Boolean(existing?.completed && block.type !== "quiz" && block.type !== "checklist_task"),
      attempts: (existing?.attempts ?? 0) + 1,
    },
    { onConflict: "user_id,lesson_version_id,block_id" },
  );
  if (error) {
    console.error("save response failed", error);
    return { ok: false, error: "Couldn't save. Check your connection and try again." };
  }

  const isActivity = block.phase === "activity";
  const progressPatch: { activity_attempted_at?: string; quiz_score?: number; last_activity_at: string } = {
    last_activity_at: new Date().toISOString(),
  };
  if (isActivity && !progress.activity_attempted_at) progressPatch.activity_attempted_at = progressPatch.last_activity_at;
  if (block.type === "quiz" && graded.result.score !== null) progressPatch.quiz_score = graded.result.score;
  await admin.from("lesson_progress").update(progressPatch).eq("id", progress.id);

  const event =
    block.type === "quiz"
      ? "quiz_submitted"
      : block.type === "reflection_prompt"
        ? "reflection_saved"
        : graded.result.completed && !existing?.completed
          ? "activity_completed"
          : "activity_attempted";
  await admin.from("learning_events").insert({
    user_id: user.id,
    course_id: lesson.course_id,
    lesson_id: lesson.id,
    lesson_version_id: progress.lesson_version_id,
    block_id: block.id,
    event_type: event,
    score: graded.result.score,
    metadata: { attempt: (existing?.attempts ?? 0) + 1, block_type: block.type },
  });

  const lessonStatus = await recompute(admin, user.id, lesson.id);
  return { ok: true, result: graded.result, lessonStatus, activityAttempted: Boolean(progress.activity_attempted_at) || isActivity };
}

export async function setPhase(lessonId: string, phase: string): Promise<void> {
  const user = await student();
  if (!uuid.safeParse(lessonId).success || ![...PHASES, "done"].includes(phase as never)) return;
  const { admin, lesson, progress } = await loadWriteContext(user, lessonId);
  // Activity-first is enforced here too, not just in the UI.
  if (lesson.require_activity_first && !progress.activity_attempted_at && phase !== "activity") return;
  if (progress.status === "completed") return;
  await admin.from("lesson_progress").update({ current_phase: phase, last_activity_at: new Date().toISOString() }).eq("id", progress.id);
}

// ---------------------------------------------------------------------------
// Uploads (upload_work + external task screenshots/files)
// ---------------------------------------------------------------------------
async function storeUpload(userId: string, file: File, accept: SafeType[]): Promise<{ path: string; type: SafeType } | { error: string }> {
  if (file.size === 0) return { error: "That file is empty." };
  if (file.size > MAX_UPLOAD) return { error: "Files can be up to 5 MB." };
  const raw = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(raw);
  if (!type || !accept.includes(type)) return { error: "Please upload a PNG, JPEG or WebP image (or a PDF where allowed)." };
  let clean: Uint8Array;
  try {
    clean = stripImageMetadata(raw, type); // removes GPS/EXIF from photos
  } catch (e) {
    if (e instanceof UnsafeImageError) return { error: "That image looks damaged. Try another one." };
    throw e;
  }
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf" }[type];
  const path = `${userId}/${randomUUID()}.${ext}`;
  const { error } = await createAdminClient().storage.from(SUBMISSIONS_BUCKET).upload(path, clean, { contentType: type, upsert: false });
  if (error) {
    console.error("upload failed", error);
    return { error: "Upload failed. Please try again." };
  }
  return { path, type };
}

export async function uploadWork(lessonId: string, id: string, form: FormData): Promise<SubmitResult> {
  const user = await student();
  if (!uuid.safeParse(lessonId).success || !blockId.safeParse(id).success) return { ok: false, error: "Invalid request." };
  if (await limited(user.id, "upload", 10)) return { ok: false, error: "Too many uploads. Try again in a minute." };
  const { admin, lesson, progress, blocks } = await loadWriteContext(user, lessonId);
  const block = findBlock(blocks, id, "upload_work");
  if (!block) return { ok: false, error: "Unknown block." };

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, block.max_files);
  if (files.length === 0) return { ok: false, error: "Choose a file first." };
  const accept: SafeType[] = [
    ...(block.accept.includes("image") ? (["image/png", "image/jpeg", "image/webp"] as const) : []),
    ...(block.accept.includes("pdf") ? (["application/pdf"] as const) : []),
  ];
  const stored: { path: string; type: string; name: string }[] = [];
  for (const f of files) {
    const r = await storeUpload(user.id, f, accept);
    if ("error" in r) return { ok: false, error: r.error };
    stored.push({ path: r.path, type: r.type, name: f.name.slice(0, 120) });
  }
  const { data: existing } = await admin
    .from("block_responses")
    .select("attempts")
    .eq("user_id", user.id)
    .eq("lesson_version_id", progress.lesson_version_id)
    .eq("block_id", block.id)
    .maybeSingle();
  await admin.from("block_responses").upsert(
    {
      user_id: user.id,
      lesson_id: lesson.id,
      lesson_version_id: progress.lesson_version_id,
      block_id: block.id,
      block_type: "upload_work",
      response: { files: stored },
      completed: true,
      attempts: (existing?.attempts ?? 0) + 1,
    },
    { onConflict: "user_id,lesson_version_id,block_id" },
  );
  const now = new Date().toISOString();
  await admin
    .from("lesson_progress")
    .update({ last_activity_at: now, ...(progress.activity_attempted_at ? {} : { activity_attempted_at: now }) })
    .eq("id", progress.id);
  await admin.from("learning_events").insert({
    user_id: user.id,
    course_id: lesson.course_id,
    lesson_id: lesson.id,
    lesson_version_id: progress.lesson_version_id,
    block_id: block.id,
    event_type: "activity_completed",
    metadata: { files: stored.length, block_type: "upload_work" },
  });
  const lessonStatus = await recompute(admin, user.id, lesson.id);
  return { ok: true, result: { score: null, completed: true }, lessonStatus, activityAttempted: true };
}

// ---------------------------------------------------------------------------
// External tasks
// ---------------------------------------------------------------------------
export async function logExternalEvent(lessonId: string, id: string, kind: "started" | "returned", awaySeconds?: number): Promise<void> {
  const user = await student();
  if (!uuid.safeParse(lessonId).success || !blockId.safeParse(id).success) return;
  if (await limited(user.id, "ext-event", 30)) return;
  const { admin, lesson, progress, blocks } = await loadWriteContext(user, lessonId);
  const block = findBlock(blocks, id, "external_task");
  if (!block) return;
  await admin.from("learning_events").insert({
    user_id: user.id,
    course_id: lesson.course_id,
    lesson_id: lesson.id,
    lesson_version_id: progress.lesson_version_id,
    block_id: block.id,
    event_type: kind === "started" ? "external_task_started" : "external_task_returned",
    metadata:
      kind === "started"
        ? { tool_id: block.tool_id }
        : { tool_id: block.tool_id, away_seconds: capAwaySeconds(awaySeconds ?? 0, block.estimated_minutes), estimated: true },
  });
  if (kind === "started" && !progress.activity_attempted_at) {
    await admin.from("lesson_progress").update({ activity_attempted_at: new Date().toISOString() }).eq("id", progress.id);
  }
}

export type ExternalSubmitResult =
  | { ok: true; lessonStatus: LessonStatus; urlStatus?: "live" | "unreachable" }
  | { ok: false; error: string };

const submitSchema = z.object({
  kind: z.enum(["url", "screenshot", "file", "text"]),
  url: z.string().max(2000).optional(),
  text: z.string().trim().max(5000).optional(),
  share_in_gallery: z.boolean(),
});

export async function submitExternal(lessonId: string, id: string, form: FormData): Promise<ExternalSubmitResult> {
  const user = await student();
  if (!uuid.safeParse(lessonId).success || !blockId.safeParse(id).success) return { ok: false, error: "Invalid request." };
  if ((await limited(user.id, "ext-submit", 10)) || !(await rateLimit(`learn:ext-submit:ip:${await getClientIp()}`, 30, 60))) {
    return { ok: false, error: "Too many submissions. Try again in a minute." };
  }
  const parsed = submitSchema.safeParse({
    kind: form.get("kind"),
    url: form.get("url") ?? undefined,
    text: form.get("text") ?? undefined,
    share_in_gallery: form.get("share_in_gallery") === "on",
  });
  if (!parsed.success) return { ok: false, error: "Something's missing — check your answer." };
  const input = parsed.data;

  const { admin, lesson, progress, blocks } = await loadWriteContext(user, lessonId);
  const block = findBlock(blocks, id, "external_task");
  if (!block) return { ok: false, error: "Unknown task." };
  if (!block.submission_types.includes(input.kind)) return { ok: false, error: "This task doesn't accept that kind of work." };

  // Which tool's rules apply: the main tool, or the alternative tool fallback.
  const toolIds = [block.tool_id, block.fallback?.kind === "alternative_tool" ? block.fallback.tool_id : null].filter(Boolean) as string[];
  const { data: tools } = await admin.from("external_tools").select("id, enabled, min_age, submission_domains").in("id", toolIds);
  const main = tools?.find((t) => t.id === block.tool_id);
  const alt = block.fallback?.kind === "alternative_tool" ? tools?.find((t) => t.id === (block.fallback as { tool_id: string }).tool_id) : undefined;
  const role = user.profile.role;
  const cls = user.profile.class_level;
  const usable = canUseTool(main, role, cls) ? main : canUseTool(alt, role, cls) ? alt : undefined;
  // Doing it with a parent (on the adult's account) is allowed even when the student is too young.
  const withParent = block.fallback?.kind === "with_parent";
  const rulesTool = usable ?? (withParent && main?.enabled ? main : undefined);
  if (!rulesTool) return { ok: false, error: "This tool isn't available for you right now." };

  const row: {
    kind: "url" | "screenshot" | "file" | "text";
    url?: string;
    text_answer?: string;
    storage_path?: string;
    url_check?: never;
  } = { kind: input.kind };
  let urlStatus: "live" | "unreachable" | undefined;

  if (input.kind === "url") {
    const res = await checkUrl(input.url ?? "", rulesTool.submission_domains);
    if (!res.ok) return { ok: false, error: res.reason };
    row.url = res.url;
    row.url_check = res.check as never;
    urlStatus = res.check.status;
  } else if (input.kind === "text") {
    if (!input.text) return { ok: false, error: "Write something first." };
    row.text_answer = input.text;
  } else {
    const file = form.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Choose a file first." };
    const accept: SafeType[] = input.kind === "screenshot" ? ["image/png", "image/jpeg", "image/webp"] : ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    const stored = await storeUpload(user.id, file, accept);
    if ("error" in stored) return { ok: false, error: stored.error };
    row.storage_path = stored.path;
  }

  const { data: sub, error } = await admin
    .from("external_submissions")
    .insert({
      ...row,
      user_id: user.id,
      course_id: lesson.course_id,
      lesson_id: lesson.id,
      lesson_version_id: progress.lesson_version_id,
      block_id: block.id,
      tool_id: rulesTool.id,
      share_in_gallery: input.share_in_gallery,
    })
    .select("id")
    .single();
  if (error) {
    console.error("submission failed", error);
    return { ok: false, error: "Couldn't save your work. Please try again." };
  }

  // A new submission reopens review: the block is not complete until approved.
  await admin.from("block_responses").upsert(
    {
      user_id: user.id,
      lesson_id: lesson.id,
      lesson_version_id: progress.lesson_version_id,
      block_id: block.id,
      block_type: "external_task",
      response: { submission_id: sub.id, status: "submitted" },
      completed: false,
    },
    { onConflict: "user_id,lesson_version_id,block_id" },
  );
  const now = new Date().toISOString();
  await admin
    .from("lesson_progress")
    .update({ last_activity_at: now, ...(progress.activity_attempted_at ? {} : { activity_attempted_at: now }) })
    .eq("id", progress.id);
  await admin.from("learning_events").insert({
    user_id: user.id,
    course_id: lesson.course_id,
    lesson_id: lesson.id,
    lesson_version_id: progress.lesson_version_id,
    block_id: block.id,
    event_type: "external_submission_created",
    metadata: { kind: input.kind, submission_id: sub.id, url_status: urlStatus ?? null },
  });
  return { ok: true, lessonStatus: await recompute(admin, user.id, lesson.id), urlStatus };
}

/**
 * When the tool can't be used and the fallback needs no submission (demo
 * video) — or there is no usable fallback at all — the student acknowledges
 * it and the step counts as done, so they're never stuck.
 */
export async function completeExternalFallback(lessonId: string, id: string): Promise<SubmitResult> {
  const user = await student();
  if (!uuid.safeParse(lessonId).success || !blockId.safeParse(id).success) return { ok: false, error: "Invalid request." };
  const { admin, lesson, progress, blocks } = await loadWriteContext(user, lessonId);
  const block = findBlock(blocks, id, "external_task");
  if (!block) return { ok: false, error: "Unknown task." };

  const { data: tools } = await admin.from("external_tools").select("id, enabled, min_age").in("id", [block.tool_id]);
  if (canUseTool(tools?.[0], user.profile.role, user.profile.class_level)) return { ok: false, error: "Use the tool for this task." };
  const kind = block.fallback?.kind ?? "none";
  if (kind === "with_parent" || kind === "alternative_tool") return { ok: false, error: "Submit your work for this task." };

  await admin.from("block_responses").upsert(
    {
      user_id: user.id,
      lesson_id: lesson.id,
      lesson_version_id: progress.lesson_version_id,
      block_id: block.id,
      block_type: "external_task",
      response: { fallback: kind },
      completed: true,
    },
    { onConflict: "user_id,lesson_version_id,block_id" },
  );
  const now = new Date().toISOString();
  await admin
    .from("lesson_progress")
    .update({ last_activity_at: now, ...(progress.activity_attempted_at ? {} : { activity_attempted_at: now }) })
    .eq("id", progress.id);
  await admin.from("learning_events").insert({
    user_id: user.id,
    course_id: lesson.course_id,
    lesson_id: lesson.id,
    lesson_version_id: progress.lesson_version_id,
    block_id: block.id,
    event_type: "activity_completed",
    metadata: { fallback: kind, block_type: "external_task" },
  });
  return { ok: true, result: { score: null, completed: true }, lessonStatus: await recompute(admin, user.id, lesson.id), activityAttempted: true };
}
