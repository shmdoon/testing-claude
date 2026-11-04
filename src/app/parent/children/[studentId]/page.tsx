import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { DailyChart, StatTile } from "@/components/charts/daily-chart";
import { formatDuration } from "@/components/charts/scale";
import { BadgeGrid } from "@/components/dashboard/badges";
import { GalleryConsentToggle } from "@/components/dashboard/profile-forms";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getStudentStats } from "@/lib/learn/stats";
import { t } from "@/i18n";

export const metadata = { title: "Child progress" };

export default async function ChildPage({ params }: PageProps<"/parent/children/[studentId]">) {
  const { studentId } = await params;
  const user = await requireArea("parent", `/parent/children/${studentId}`);
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("parent_student_links")
    .select("gallery_consent, profiles!parent_student_links_student_id_fkey(full_name, class_level, account_status)")
    .eq("parent_id", user.id)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();
  if (!link) notFound();

  const [stats, { data: recent }, { data: subs }] = await Promise.all([
    getStudentStats(supabase, studentId, 30),
    supabase.from("lesson_progress").select("status, quiz_score, last_activity_at, lessons(title), courses(title)").eq("user_id", studentId).order("last_activity_at", { ascending: false }).limit(10),
    supabase.from("external_submissions").select("id, status, feedback, kind, url, created_at, lessons(title)").eq("user_id", studentId).order("created_at", { ascending: false }).limit(10),
  ]);
  const name = link.profiles?.full_name ?? "Your child";
  const first = name.split(" ")[0]!;

  return (
    <div className="space-y-6">
      <Link href="/parent" className="inline-flex min-h-11 items-center font-medium text-muted-foreground hover:text-foreground">
        ← {t("parent.title")}
      </Link>
      <PageHeader title={name} description={`Class ${link.profiles?.class_level ?? "?"}`} />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label={t("parent.thisWeek")} value={formatDuration(stats.weekActiveSeconds)} sub={stats.weekExternalSeconds ? `+${formatDuration(stats.weekExternalSeconds)} ${t("parent.estimatedElsewhere")}` : undefined} />
        <StatTile label={t("parent.lessonsDone")} value={String(stats.lessonsCompleted)} />
        <StatTile label={t("learn.streak")} value={`${stats.streak} days`} sub={`Best: ${stats.bestStreak}`} />
        <StatTile label="Total time" value={formatDuration(stats.totalSeconds)} />
      </div>
      <Card>
        <DailyChart
          title={`${first}'s learning time, last 30 days`}
          unit="min"
          series={[
            { label: "Active on the platform", color: "chart-1" },
            { label: "On other websites (estimated)", color: "chart-2" },
          ]}
          data={stats.daily}
        />
        <p className="text-xs text-muted-foreground">{t("parent.estimatedNote")}</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Courses</CardTitle>
          {stats.courses.length ? (
            <ul className="space-y-3">
              {stats.courses.map((c) => (
                <li key={c.id}>
                  <p className="flex justify-between text-sm font-medium">
                    <span>{c.title}</span>
                    <span className="text-muted-foreground">
                      {c.done}/{c.total} · {formatDuration(c.seconds)}
                    </span>
                  </p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-success" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Not enrolled in a course yet.</p>
          )}
        </Card>
        <Card>
          <CardTitle>Recent lessons</CardTitle>
          <ul className="divide-y">
            {(recent ?? []).map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="flex-1">
                  {r.lessons?.title} <span className="text-muted-foreground">· {r.courses?.title}</span>
                </span>
                {r.quiz_score !== null && <span className="text-muted-foreground">Quiz {r.quiz_score}%</span>}
                <Badge variant={r.status === "completed" ? "success" : "outline"}>{r.status.replace("_", " ")}</Badge>
              </li>
            ))}
            {!recent?.length && <li className="py-2 text-muted-foreground">Nothing yet.</li>}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>Projects &amp; teacher feedback</CardTitle>
        <ul className="divide-y">
          {(subs ?? []).map((s) => (
            <li key={s.id} className="space-y-1 py-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="flex-1 font-medium">{s.lessons?.title}</span>
                <Badge variant={s.status === "approved" ? "success" : s.status === "needs_revision" ? "warning" : "outline"}>{s.status.replace("_", " ")}</Badge>
              </p>
              {s.url && (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">
                  {s.url}
                </a>
              )}
              {s.feedback && <p className="text-muted-foreground">Teacher: “{s.feedback}”</p>}
            </li>
          ))}
          {!subs?.length && <li className="py-2 text-muted-foreground">No projects submitted yet.</li>}
        </ul>
        <GalleryConsentToggle studentId={studentId} initial={link.gallery_consent} name={first} />
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Badges</h2>
        <BadgeGrid badges={stats.badges} />
      </section>
    </div>
  );
}
