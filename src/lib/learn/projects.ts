import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth/dal";
import { ARENAS, type ArenaId } from "@/lib/sim/arena";
import type { Block } from "@/content/blocks/schema";

export type ProjectStatus = "not_started" | "in_progress" | "completed" | "awaiting_review";

export type Project = {
  lessonId: string;
  courseSlug: string;
  courseTitle: string;
  lessonSlug: string;
  title: string;
  summary: string | null;
  minutes: number;
  difficulty: number;
  arena: ArenaId;
  arenaName: string;
  mode: "demonstrate" | "label" | "both";
  learner: "knn" | "mlp";
  open: boolean;
  status: ProjectStatus;
  bestSeconds: number | null;
  attempts: number;
};

export const DIFFICULTY_LABEL = ["", "Easy", "Easy", "Medium", "Hard", "Hardest"] as const;

/**
 * Every published rover project the student can see, easiest first.
 * A project = a lesson whose published version contains a `robot_sim` block.
 */
export async function getProjectLadder(user: CurrentUser): Promise<{ projects: Project[]; nextUp: Project | null }> {
  const supabase = await createClient();
  const [{ data: lessons }, { data: enrollments }, { data: progress }, { data: responses }] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, slug, title, summary, estimated_minutes, position, is_preview, course_id, courses!inner(slug, title, status, is_free), lesson_versions!lessons_published_version_fkey(blocks)")
      .not("published_version_id", "is", null)
      .eq("courses.status", "published"),
    supabase.from("enrollments").select("course_id").eq("user_id", user.id).eq("status", "active"),
    supabase.from("lesson_progress").select("lesson_id, status").eq("user_id", user.id),
    supabase.from("block_responses").select("lesson_id, response, completed, attempts").eq("user_id", user.id).eq("block_type", "robot_sim"),
  ]);
  const enrolled = new Set((enrollments ?? []).map((e) => e.course_id));
  const statusOf = new Map((progress ?? []).map((p) => [p.lesson_id, p.status as ProjectStatus]));
  const best = new Map<string, { seconds: number | null; attempts: number }>();
  for (const r of responses ?? []) {
    const resp = r.response as { seconds?: number | null } | null;
    const prev = best.get(r.lesson_id);
    const seconds = r.completed ? (resp?.seconds ?? null) : null;
    best.set(r.lesson_id, {
      seconds: prev?.seconds !== null && prev?.seconds !== undefined && seconds !== null ? Math.min(prev.seconds, seconds) : (seconds ?? prev?.seconds ?? null),
      attempts: (prev?.attempts ?? 0) + r.attempts,
    });
  }
  const active = user.profile.account_status === "active";
  const projects: Project[] = [];
  for (const l of lessons ?? []) {
    const blocks = (l.lesson_versions?.blocks ?? []) as Block[];
    const sim = blocks.find((b) => b.type === "robot_sim");
    if (!sim || sim.type !== "robot_sim" || !l.courses) continue;
    projects.push({
      lessonId: l.id,
      courseSlug: l.courses.slug,
      courseTitle: l.courses.title,
      lessonSlug: l.slug,
      title: l.title,
      summary: l.summary,
      minutes: l.estimated_minutes,
      difficulty: sim.difficulty,
      arena: sim.arena,
      arenaName: ARENAS[sim.arena].name,
      mode: sim.mode,
      learner: sim.learner,
      open: active && (enrolled.has(l.course_id) || l.courses.is_free || l.is_preview),
      status: statusOf.get(l.id) ?? "not_started",
      bestSeconds: best.get(l.id)?.seconds ?? null,
      attempts: best.get(l.id)?.attempts ?? 0,
    });
  }
  projects.sort((a, b) => a.difficulty - b.difficulty || a.courseSlug.localeCompare(b.courseSlug) || a.lessonSlug.localeCompare(b.lessonSlug));
  const nextUp = projects.find((p) => p.open && p.status !== "completed") ?? null;
  return { projects, nextUp };
}
