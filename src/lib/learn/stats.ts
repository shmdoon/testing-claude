import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { addDays, fillDays, istDate } from "@/lib/reports/days";
import { bestStreak, computeBadges, streak, type Badge } from "./badges";
import { istWeekStart } from "./queries";

type Client = SupabaseClient<Database>;

export type StudentStats = {
  streak: number;
  bestStreak: number;
  weekActiveSeconds: number;
  weekExternalSeconds: number;
  totalSeconds: number;
  lessonsCompleted: number;
  courses: { id: string; slug: string; title: string; done: number; total: number; seconds: number }[];
  daily: { date: string; values: number[] }[];
  badges: Badge[];
};

/**
 * Everything the student/parent/admin views show about one student.
 * Runs with the CALLER's client: RLS decides (self, linked parent, admin).
 */
export async function getStudentStats(supabase: Client, userId: string, days = 14): Promise<StudentStats> {
  const today = istDate();
  const since = addDays(today, -120);
  const [{ data: daily }, { data: progress }, { data: enr }, { data: quiz }, { data: refl }, { data: subs }, { data: perCourse }] = await Promise.all([
    supabase.from("daily_activity").select("date, active_seconds, estimated_external_seconds").eq("user_id", userId).gte("date", since),
    supabase.from("lesson_progress").select("course_id, status").eq("user_id", userId),
    supabase
      .from("enrollments")
      .select("course_id, courses(id, slug, title, lessons(id, published_version_id))")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase.from("block_responses").select("id").eq("user_id", userId).eq("block_type", "quiz").eq("score", 100),
    supabase.from("block_responses").select("id").eq("user_id", userId).eq("block_type", "reflection_prompt").eq("completed", true),
    supabase.from("external_submissions").select("id").eq("user_id", userId).eq("status", "approved"),
    supabase.from("activity_minutes").select("course_id, seconds").eq("user_id", userId),
  ]);

  const rows = (daily ?? []).map((d) => ({ date: d.date!, a: d.active_seconds ?? 0, e: d.estimated_external_seconds ?? 0 }));
  const activeDates = rows.filter((r) => r.a > 0).map((r) => r.date);
  const weekStart = istWeekStart(new Date());
  const doneByCourse = new Map<string, number>();
  for (const p of progress ?? []) if (p.status === "completed") doneByCourse.set(p.course_id, (doneByCourse.get(p.course_id) ?? 0) + 1);
  const secondsByCourse = new Map<string, number>();
  for (const r of perCourse ?? []) secondsByCourse.set(r.course_id, (secondsByCourse.get(r.course_id) ?? 0) + r.seconds);

  const courses = (enr ?? []).flatMap((e) => {
    if (!e.courses) return [];
    const total = e.courses.lessons.filter((l) => l.published_version_id).length;
    return [{ id: e.courses.id, slug: e.courses.slug, title: e.courses.title, done: Math.min(doneByCourse.get(e.course_id) ?? 0, total), total, seconds: secondsByCourse.get(e.course_id) ?? 0 }];
  });
  const totalSeconds = rows.reduce((s, r) => s + r.a, 0);
  const lessonsCompleted = (progress ?? []).filter((p) => p.status === "completed").length;
  const best = bestStreak(activeDates);

  return {
    streak: streak(activeDates, today),
    bestStreak: best,
    weekActiveSeconds: rows.filter((r) => r.date >= weekStart).reduce((s, r) => s + r.a, 0),
    weekExternalSeconds: rows.filter((r) => r.date >= weekStart).reduce((s, r) => s + r.e, 0),
    totalSeconds,
    lessonsCompleted,
    courses,
    daily: fillDays(addDays(today, -(days - 1)), today, rows, (r) => [Math.round((r?.a ?? 0) / 60), Math.round((r?.e ?? 0) / 60)]),
    badges: computeBadges({
      lessonsCompleted,
      coursesCompleted: courses.filter((c) => c.total > 0 && c.done >= c.total).length,
      bestStreak: best,
      perfectQuizzes: quiz?.length ?? 0,
      projectsApproved: subs?.length ?? 0,
      totalMinutes: Math.round(totalSeconds / 60),
      reflections: refl?.length ?? 0,
    }),
  };
}
