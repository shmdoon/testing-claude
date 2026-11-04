import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { DailyChart, StatTile } from "@/components/charts/daily-chart";
import { formatDuration } from "@/components/charts/scale";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getStudentStats } from "@/lib/learn/stats";

export const metadata = { title: "Student" };

export default async function StudentDetail({ params }: PageProps<"/admin/students/[studentId]">) {
  const { studentId } = await params;
  await requireArea("admin");
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("full_name, email, class_level, account_status, created_at, acquisition").eq("id", studentId).eq("role", "student").maybeSingle();
  if (!p) notFound();

  const [stats, { data: progress }, { data: minutes }, { data: responses }, { data: events }] = await Promise.all([
    getStudentStats(supabase, studentId, 30),
    supabase.from("lesson_progress").select("lesson_id, status, quiz_score, started_at, completed_at, lessons(title, position), courses(title)").eq("user_id", studentId),
    supabase.from("activity_minutes").select("lesson_id, seconds").eq("user_id", studentId),
    supabase.from("block_responses").select("lesson_id, block_type, attempts, score").eq("user_id", studentId),
    supabase.from("learning_events").select("event_type, occurred_at, score, lessons(title)").eq("user_id", studentId).order("occurred_at", { ascending: false }).limit(25),
  ]);
  const secs = new Map<string, number>();
  for (const m of minutes ?? []) if (m.lesson_id) secs.set(m.lesson_id, (secs.get(m.lesson_id) ?? 0) + m.seconds);
  const attempts = new Map<string, number>();
  for (const r of responses ?? []) if (r.block_type !== "quiz" && r.block_type !== "reflection_prompt") attempts.set(r.lesson_id, (attempts.get(r.lesson_id) ?? 0) + r.attempts);

  return (
    <div className="space-y-6">
      <Link href="/admin/students" className="inline-flex min-h-11 items-center font-medium text-muted-foreground hover:text-foreground">
        ← Students
      </Link>
      <PageHeader title={p.full_name ?? p.email} description={`${p.email} · Class ${p.class_level ?? "?"} · joined ${new Date(p.created_at).toLocaleDateString("en-IN")}`} />
      <div className="flex gap-2">
        <Badge variant={p.account_status === "active" ? "success" : "warning"}>{p.account_status.replace("_", " ")}</Badge>
        {p.acquisition && <Badge variant="outline">via {Object.values(p.acquisition as Record<string, string>).join(" / ")}</Badge>}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="This week" value={formatDuration(stats.weekActiveSeconds)} sub={stats.weekExternalSeconds ? `+${formatDuration(stats.weekExternalSeconds)} est. elsewhere` : undefined} />
        <StatTile label="Total active time" value={formatDuration(stats.totalSeconds)} />
        <StatTile label="Lessons completed" value={String(stats.lessonsCompleted)} />
        <StatTile label="Streak" value={`${stats.streak} days`} sub={`Best ${stats.bestStreak}`} />
      </div>
      <Card>
        <DailyChart
          title="Daily learning time, last 30 days"
          unit="min"
          series={[
            { label: "Active on the platform", color: "chart-1" },
            { label: "On other websites (estimated)", color: "chart-2" },
          ]}
          data={stats.daily}
        />
      </Card>
      <Card>
        <CardTitle>Per course</CardTitle>
        <ul className="space-y-2 text-sm">
          {stats.courses.map((c) => (
            <li key={c.id} className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{c.title}</span>
              <span className="text-muted-foreground tabular-nums">
                {c.done}/{c.total} lessons · {formatDuration(c.seconds)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>Per lesson</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b">
              <tr>
                {["Lesson", "Course", "Status", "Active time", "Activity attempts", "Quiz score"].map((h) => (
                  <th key={h} scope="col" className="p-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {(progress ?? []).map((r) => (
                <tr key={r.lesson_id} className="border-b last:border-0" data-testid="lesson-row">
                  <td className="p-2">{r.lessons?.title}</td>
                  <td className="p-2 text-muted-foreground">{r.courses?.title}</td>
                  <td className="p-2">
                    <Badge variant={r.status === "completed" ? "success" : "outline"}>{r.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="p-2">{formatDuration(secs.get(r.lesson_id) ?? 0)}</td>
                  <td className="p-2">{attempts.get(r.lesson_id) ?? 0}</td>
                  <td className="p-2">{r.quiz_score === null ? "—" : `${r.quiz_score}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <CardTitle>Recent activity</CardTitle>
        <ul className="divide-y text-sm">
          {(events ?? []).map((e, i) => (
            <li key={i} className="flex flex-wrap gap-2 py-2">
              <span className="w-40 text-muted-foreground tabular-nums">{new Date(e.occurred_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
              <span className="font-medium">{e.event_type.replaceAll("_", " ")}</span>
              <span className="text-muted-foreground">{e.lessons?.title}</span>
              {e.score !== null && <span className="tabular-nums">{e.score}%</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
