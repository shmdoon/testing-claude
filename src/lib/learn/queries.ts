import "server-only";
import { notFound } from "next/navigation";
import { requireArea, type CurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { blockSchema, type Block } from "@/content/blocks/schema";
import { gradeBlock, isGradable, sanitizeBlocksForStudent, seededShuffle, type GradeResult, type StudentBlock } from "@/content/blocks/grading";
import { canUseTool } from "./age";
import { checkLessonAccess, isStaff, type LessonAccess } from "./access";
import { streak } from "./badges";
import { addDays, istDate } from "@/lib/reports/days";

export type LessonStatus = "not_started" | "in_progress" | "awaiting_review" | "completed";

// ---------------------------------------------------------------------------
// Course home (/learn/[courseSlug])
// ---------------------------------------------------------------------------
export async function getLearnCourse(courseSlug: string) {
  const user = await requireArea("learn", `/learn/${courseSlug}`);
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, slug, title, subtitle, course_type, is_free, price_paise, status, cover_image_path, modules(id, title, position, lessons(id, slug, title, summary, position, estimated_minutes, is_preview, published_version_id))",
    )
    .eq("slug", courseSlug)
    .maybeSingle();
  if (!course) notFound();

  const [{ data: enrollment }, { data: progress }] = await Promise.all([
    supabase.from("enrollments").select("id, status").eq("user_id", user.id).eq("course_id", course.id).maybeSingle(),
    supabase.from("lesson_progress").select("lesson_id, status").eq("user_id", user.id).eq("course_id", course.id),
  ]);
  const statusByLesson = new Map((progress ?? []).map((p) => [p.lesson_id, p.status as LessonStatus]));
  const enrolled = enrollment?.status === "active";
  const modules = [...course.modules]
    .sort((a, b) => a.position - b.position)
    .map((m) => ({
      ...m,
      lessons: [...m.lessons]
        .filter((l) => l.published_version_id || isStaff(user.profile.role))
        .sort((a, b) => a.position - b.position)
        .map((l) => ({
          ...l,
          status: statusByLesson.get(l.id) ?? ("not_started" as LessonStatus),
          open:
            isStaff(user.profile.role) ||
            (user.profile.account_status === "active" && (enrolled || l.is_preview)),
        })),
    }));
  const all = modules.flatMap((m) => m.lessons);
  return {
    user,
    course,
    enrolled,
    modules,
    completed: all.filter((l) => l.status === "completed").length,
    total: all.length,
  };
}

// ---------------------------------------------------------------------------
// Lesson player (/learn/[courseSlug]/[lessonSlug])
// ---------------------------------------------------------------------------
export type PlayerTool = { id: string; name: string; base_url: string; min_age: number; enabled: boolean; requires_account: boolean; logo_url: string | null };
export type PlayerSubmission = {
  id: string;
  kind: "url" | "screenshot" | "file" | "text";
  url: string | null;
  text_answer: string | null;
  status: "submitted" | "approved" | "needs_revision";
  feedback: string | null;
  created_at: string;
  url_check: unknown;
};
export type ExternalExtras = {
  tool: PlayerTool | null;
  eligible: boolean;
  fallbackTool: PlayerTool | null;
  fallbackToolEligible: boolean;
  submissions: PlayerSubmission[];
};
export type SavedResponse = { response: unknown; score: number | null; completed: boolean; attempts: number; result?: GradeResult };

export type PlayerData =
  | { kind: "blocked"; reason: Exclude<LessonAccess, { ok: true }>["reason"]; course: { slug: string; title: string } }
  | {
      kind: "ok";
      user: CurrentUser;
      course: { id: string; slug: string; title: string };
      lesson: { id: string; slug: string; title: string; summary: string | null; require_activity_first: boolean; estimated_minutes: number };
      versionNumber: number | null;
      newerVersionAvailable: boolean;
      blocks: StudentBlock[];
      /** Phases whose content is held back until the activity is attempted. */
      lockedPhases: string[];
      responses: Record<string, SavedResponse>;
      external: Record<string, ExternalExtras>;
      progress: { status: LessonStatus; current_phase: string; activity_attempted: boolean; quiz_score: number | null };
      next: { slug: string; title: string } | null;
    };

export async function getPlayerData(courseSlug: string, lessonSlug: string): Promise<PlayerData> {
  const user = await requireArea("learn", `/learn/${courseSlug}/${lessonSlug}`);
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, title, status, modules(position, lessons(id, slug, title, position, published_version_id))")
    .eq("slug", courseSlug)
    .maybeSingle();
  if (!course) notFound();
  const ordered = [...course.modules]
    .sort((a, b) => a.position - b.position)
    .flatMap((m) => [...m.lessons].sort((a, b) => a.position - b.position))
    .filter((l) => l.published_version_id);

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, slug, title, summary, course_id, is_preview, published_version_id, require_activity_first, estimated_minutes")
    .eq("course_id", course.id)
    .eq("slug", lessonSlug)
    .maybeSingle();
  if (!lesson) notFound();

  const access = await checkLessonAccess(user, lesson, course.status);
  if (!access.ok) return { kind: "blocked", reason: access.reason, course: { slug: course.slug, title: course.title } };
  if (!lesson.published_version_id) notFound();

  // Start (or resume) — the version is pinned on first start.
  let { data: progress } = await admin.from("lesson_progress").select("*").eq("user_id", user.id).eq("lesson_id", lesson.id).maybeSingle();
  if (!progress) {
    const { data: created, error } = await admin
      .from("lesson_progress")
      .upsert(
        { user_id: user.id, course_id: course.id, lesson_id: lesson.id, lesson_version_id: lesson.published_version_id },
        { onConflict: "user_id,lesson_id", ignoreDuplicates: false },
      )
      .select("*")
      .single();
    if (error) throw error;
    progress = created;
    await admin.from("learning_events").insert({
      user_id: user.id,
      course_id: course.id,
      lesson_id: lesson.id,
      lesson_version_id: progress.lesson_version_id,
      event_type: "lesson_started",
    });
  }

  const { data: version } = await admin
    .from("lesson_versions")
    .select("id, version, blocks")
    .eq("id", progress.lesson_version_id)
    .single();
  const blocks: Block[] = (Array.isArray(version?.blocks) ? version.blocks : []).flatMap((b) => {
    const p = blockSchema.safeParse(b);
    return p.success ? [p.data] : []; // invalid blocks are skipped, never shown
  });

  // Saved responses (+ server-graded results so quizzes can show past results).
  const { data: rows } = await admin
    .from("block_responses")
    .select("block_id, response, score, completed, attempts")
    .eq("user_id", user.id)
    .eq("lesson_version_id", progress.lesson_version_id);
  const responses: Record<string, SavedResponse> = {};
  for (const r of rows ?? []) {
    const block = blocks.find((b) => b.id === r.block_id);
    let result: GradeResult | undefined;
    if (block && isGradable(block.type)) {
      const g = gradeBlock(block, r.response);
      if (g.ok) result = g.result;
    }
    responses[r.block_id] = { response: r.response, score: r.score, completed: r.completed, attempts: r.attempts, result };
  }

  // External tasks: tool, eligibility, fallback, submissions.
  const external: Record<string, ExternalExtras> = {};
  const extBlocks = blocks.filter((b): b is Extract<Block, { type: "external_task" }> => b.type === "external_task");
  if (extBlocks.length) {
    const toolIds = [...new Set(extBlocks.flatMap((b) => [b.tool_id, b.fallback?.kind === "alternative_tool" ? b.fallback.tool_id : null]).filter(Boolean))] as string[];
    const [{ data: tools }, { data: subs }] = await Promise.all([
      admin.from("external_tools").select("id, name, base_url, min_age, enabled, requires_account, logo_url").in("id", toolIds),
      admin
        .from("external_submissions")
        .select("id, block_id, kind, url, text_answer, status, feedback, created_at, url_check")
        .eq("user_id", user.id)
        .eq("lesson_version_id", progress.lesson_version_id)
        .order("created_at", { ascending: false }),
    ]);
    const byId = new Map((tools ?? []).map((t) => [t.id, t]));
    for (const b of extBlocks) {
      const tool = byId.get(b.tool_id) ?? null;
      const fallbackTool = b.fallback?.kind === "alternative_tool" ? (byId.get(b.fallback.tool_id) ?? null) : null;
      external[b.id] = {
        tool,
        eligible: canUseTool(tool ?? undefined, user.profile.role, user.profile.class_level),
        fallbackTool,
        fallbackToolEligible: canUseTool(fallbackTool ?? undefined, user.profile.role, user.profile.class_level),
        submissions: (subs ?? []).filter((s) => s.block_id === b.id).map(({ block_id: _b, ...s }) => (void _b, s)),
      };
    }
  }

  // Activity-first: hold back everything after the activity until it's attempted.
  const activityAttempted = Boolean(progress.activity_attempted_at) || !blocks.some((b) => b.phase === "activity");
  const hold = lesson.require_activity_first && !activityAttempted;
  const visible = hold ? blocks.filter((b) => b.phase === "activity") : blocks;
  const lockedPhases = hold ? [...new Set(blocks.filter((b) => b.phase !== "activity").map((b) => b.phase))] : [];

  // Shuffle sortable items per student so the answer isn't the display order.
  const shuffled = visible.map((b) =>
    b.type === "drag_sort" ? { ...b, items: seededShuffle(b.items, `${user.id}:${b.id}`) } : b,
  );

  const idx = ordered.findIndex((l) => l.id === lesson.id);
  const nextLesson = idx >= 0 ? ordered[idx + 1] : undefined;

  return {
    kind: "ok",
    user,
    course: { id: course.id, slug: course.slug, title: course.title },
    lesson: {
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      require_activity_first: lesson.require_activity_first,
      estimated_minutes: lesson.estimated_minutes,
    },
    versionNumber: version?.version ?? null,
    newerVersionAvailable: progress.lesson_version_id !== lesson.published_version_id,
    blocks: sanitizeBlocksForStudent(shuffled),
    lockedPhases,
    responses,
    external,
    progress: {
      status: progress.status as LessonStatus,
      current_phase: progress.current_phase,
      activity_attempted: activityAttempted,
      quiz_score: progress.quiz_score,
    },
    next: nextLesson ? { slug: nextLesson.slug, title: nextLesson.title } : null,
  };
}

// ---------------------------------------------------------------------------
// Dashboard (/learn)
// ---------------------------------------------------------------------------
export async function getStudentDashboard() {
  const user = await requireArea("learn", "/learn");
  const supabase = await createClient();
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id, courses(id, slug, title, subtitle, cover_image_path, lessons(count))")
    .eq("user_id", user.id)
    .eq("status", "active");
  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("course_id, status, last_activity_at, lessons(slug, title), courses(slug, title)")
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false });

  const courses = (enrollments ?? []).flatMap((e) => {
    if (!e.courses) return [];
    const done = (progress ?? []).filter((p) => p.course_id === e.course_id && p.status === "completed").length;
    const total = e.courses.lessons[0]?.count ?? 0;
    return [{ ...e.courses, done, total, percent: total ? Math.round((done / total) * 100) : 0 }];
  });
  const resume = (progress ?? []).find((p) => p.status !== "completed" && p.lessons && p.courses) ?? null;

  // This week (Monday-start, India time): active minutes + estimated external minutes.
  const weekStart = istWeekStart(new Date());
  const { data: week } = await supabase
    .from("weekly_activity")
    .select("active_seconds, estimated_external_seconds")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle();
  const time = {
    activeMinutes: Math.round((week?.active_seconds ?? 0) / 60),
    externalMinutes: Math.round((week?.estimated_external_seconds ?? 0) / 60),
  };
  const { data: days } = await supabase.from("daily_activity").select("date, active_seconds").eq("user_id", user.id).gte("date", addDays(istDate(), -60));
  const streakDays = streak((days ?? []).filter((d) => (d.active_seconds ?? 0) > 0).map((d) => d.date!), istDate());
  return { user, courses, resume, time, streak: streakDays };
}

/** Monday of the current week in India time, as YYYY-MM-DD (matches the SQL views). */
export function istWeekStart(now: Date): string {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const day = (ist.getUTCDay() + 6) % 7; // Monday = 0
  ist.setUTCDate(ist.getUTCDate() - day);
  return ist.toISOString().slice(0, 10);
}
