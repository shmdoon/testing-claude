import Link from "next/link";
import { CheckCircle2, Circle, CircleDot, Hourglass, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EnrollButton } from "@/components/player/enroll-button";
import { TrackCourse } from "@/components/player/track-course";
import { AskParentToPay, ResendConsent } from "@/components/payments/ask-parent";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import { getLearnCourse, type LessonStatus } from "@/lib/learn/queries";
import { formatInr } from "@/lib/format";
import { t } from "@/i18n";

export const metadata = { title: "Course" };

const ICON: Record<LessonStatus, React.ReactNode> = {
  completed: <CheckCircle2 className="size-6 text-success" aria-hidden />,
  awaiting_review: <Hourglass className="size-6 text-warning-foreground dark:text-warning" aria-hidden />,
  in_progress: <CircleDot className="size-6 text-primary" aria-hidden />,
  not_started: <Circle className="size-6 text-muted-foreground" aria-hidden />,
};

async function PaidBanner({ searchParams }: { searchParams: PageProps<"/learn/[courseSlug]">["searchParams"] }) {
  const sp = await searchParams;
  if (!sp.paid) return null;
  return (
    <p role="status" className="rounded-2xl border-2 border-success/50 bg-success/10 p-4 font-semibold">
      {sp.pending ? t("pay.pendingBanner") : t("pay.paidBanner")}
    </p>
  );
}

export default async function LearnCoursePage({ params, searchParams }: PageProps<"/learn/[courseSlug]">) {
  const { courseSlug } = await params;
  const { user, course, enrolled, modules, completed, total } = await getLearnCourse(courseSlug);
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const pending = user.profile.account_status !== "active" && user.profile.role === "student";

  return (
    <div className="space-y-6">
      {enrolled && <TrackCourse courseId={course.id} />}
      <Suspense>
        <PaidBanner searchParams={searchParams} />
      </Suspense>
      <Link href="/learn" className="inline-flex min-h-11 items-center font-medium text-muted-foreground hover:text-foreground">
        ← {t("nav.dashboard")}
      </Link>
      <header className="space-y-3">
        <h1 className="text-3xl font-bold sm:text-4xl">{course.title}</h1>
        {course.subtitle && <p className="text-lg text-muted-foreground">{course.subtitle}</p>}
        {enrolled && (
          <div className="space-y-1">
            <div
              className="h-3 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("learn.courseProgress")}
            >
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">{t("learn.lessonsDone", { done: completed, total })}</p>
          </div>
        )}
      </header>

      {pending ? (
        <div role="status" className="space-y-2 rounded-2xl border-2 border-warning/60 bg-warning/15 p-4">
          <p>{t("learn.pendingConsent")}</p>
          <ResendConsent />
        </div>
      ) : (
        !enrolled &&
        (course.is_free ? (
          <EnrollButton courseId={course.id} />
        ) : (
          <div className="space-y-3 rounded-2xl border-2 border-dashed p-4">
            <p>
              <strong>{formatInr(course.price_paise)}</strong> · {t("pay.buyAsk")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/learn/checkout/${course.slug}`}>{t("pay.payHere")}</Link>
              </Button>
              <AskParentToPay courseId={course.id} />
            </div>
          </div>
        ))
      )}

      <div className="space-y-6">
        {modules.map((m) => (
          <section key={m.id} aria-labelledby={`m-${m.id}`}>
            {course.course_type === "big" && (
              <h2 id={`m-${m.id}`} className="mb-3 text-xl font-bold">
                {m.title}
              </h2>
            )}
            <ol className="space-y-2">
              {m.lessons.map((l) => {
                const body = (
                  <>
                    {l.open ? ICON[l.status] : <Lock className="size-6 text-muted-foreground" aria-hidden />}
                    <span className="flex-1">
                      <span className="block font-semibold">{l.title}</span>
                      {l.summary && <span className="block text-sm text-muted-foreground">{l.summary}</span>}
                    </span>
                    {l.is_preview && !enrolled && <Badge variant="accent">{t("courses.preview")}</Badge>}
                    <span className="sr-only">{t(`learn.status_${l.open ? l.status : "locked"}` as never)}</span>
                    <span className="text-sm whitespace-nowrap text-muted-foreground">{t("courses.minutes", { n: l.estimated_minutes })}</span>
                  </>
                );
                return (
                  <li key={l.id}>
                    {l.open ? (
                      <Link
                        href={`/learn/${course.slug}/${l.slug}`}
                        className="flex min-h-16 items-center gap-3 rounded-2xl border-2 bg-card p-3 transition hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex min-h-16 items-center gap-3 rounded-2xl border-2 border-dashed bg-muted/40 p-3 opacity-80">{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
