import Link from "next/link";
import { Clock, Flame, Hourglass, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { CourseCover } from "@/components/course-card";
import { getStudentDashboard } from "@/lib/learn/queries";
import { ResendConsent } from "@/components/payments/ask-parent";
import { t } from "@/i18n";

export const metadata = { title: "Dashboard" };

export default async function LearnDashboard() {
  const { user, courses, resume, time, streak } = await getStudentDashboard();
  const name = user.profile.full_name?.split(" ")[0];
  return (
    <div className="space-y-6">
      <PageHeader title={name ? t("learn.welcome", { name }) : t("learn.welcomeFallback")} />
      {user.profile.account_status === "pending_consent" && (
        <div role="status" className="flex gap-3 rounded-2xl border-2 border-warning/60 bg-warning/15 p-4">
          <Hourglass className="mt-0.5 size-6 shrink-0" aria-hidden />
          <div className="space-y-2">
            <p>{t("learn.pendingConsent")}</p>
            <ResendConsent />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
      <Card className="flex-row items-center gap-4">
        <Flame className="size-8 shrink-0 text-coral" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{t("learn.streak")}</p>
          <p className="text-2xl font-bold">{t("learn.streakDays", { n: streak })}</p>
        </div>
      </Card>
      <Card className="flex-row items-center gap-4" aria-label={t("learn.thisWeek")}>
        <Clock className="size-8 shrink-0 text-teal" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{t("learn.thisWeek")}</p>
          <p className="text-2xl font-bold" data-testid="week-active">
            {t("learn.activeMinutes", { n: time.activeMinutes })}
          </p>
          {time.externalMinutes > 0 && (
            <p className="text-sm text-muted-foreground" data-testid="week-external">
              {t("learn.externalMinutes", { n: time.externalMinutes })}
            </p>
          )}
        </div>
      </Card>
      </div>

      {resume?.lessons && resume.courses && (
        <Card className="flex-row flex-wrap items-center gap-4 border-primary/40 bg-primary/5">
          <PlayCircle className="size-10 text-primary" aria-hidden />
          <div className="flex-1">
            <p className="text-sm font-semibold text-muted-foreground">{t("learn.continue")}</p>
            <p className="text-lg font-bold">{resume.lessons.title}</p>
            <p className="text-sm text-muted-foreground">{resume.courses.title}</p>
          </div>
          <Button asChild size="lg">
            <Link href={`/learn/${resume.courses.slug}/${resume.lessons.slug}`}>{t("learn.resume")}</Link>
          </Button>
        </Card>
      )}

      <section aria-labelledby="my-courses" className="space-y-3">
        <h2 id="my-courses" className="text-2xl font-bold">
          {t("learn.myCourses")}
        </h2>
        {courses.length === 0 ? (
          <Card className="items-start">
            <CardDescription>{t("learn.dashboardEmpty")}</CardDescription>
            <Button asChild>
              <Link href="/courses">{t("learn.browse")}</Link>
            </Button>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {courses.map((c) => (
              <li key={c.id}>
                <Link href={`/learn/${c.slug}`} className="block overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
                  <CourseCover path={c.cover_image_path} />
                  <div className="space-y-2 p-4">
                    <p className="text-lg font-bold">{c.title}</p>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={c.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t("learn.courseProgress")}>
                      <div className="h-full rounded-full bg-success" style={{ width: `${c.percent}%` }} />
                    </div>
                    <p className="text-sm text-muted-foreground">{t("learn.lessonsDone", { done: c.done, total: c.total })}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
