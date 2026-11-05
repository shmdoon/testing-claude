import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, Lock, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CourseCover } from "@/components/course-card";
import { BlockPreview } from "@/content/blocks/registry";
import { getCourseBySlug } from "@/lib/content/catalog";
import { formatInr } from "@/lib/format";
import { t } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return { title: "Course not found" };
  const description = course.subtitle || course.description?.slice(0, 160) || `${course.title} — a hands-on AI course for Class ${course.class_levels.join("–")} on AI Learning Hub.`;
  return { title: course.title, description };
}

export default function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  return (
    // Fallback fills the viewport so the footer doesn't jump when the course streams in (CLS).
    <Suspense fallback={<div className="mx-auto min-h-svh max-w-6xl px-4 py-10" aria-busy="true" />}>
      <CourseDetail params={params} />
    </Suspense>
  );
}

async function CourseDetail({ params }: { params: PageProps<"/courses/[slug]">["params"] }) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const lessons = course.modules.flatMap((m) => m.lessons);
  const totalMinutes = lessons.reduce((s, l) => s + l.estimated_minutes, 0);
  const ctx = { tools: Object.fromEntries(course.tools.map((tool) => [tool.id, tool])) };

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{course.course_type === "mini" ? t("courses.mini") : t("courses.big")}</Badge>
            <Badge variant="outline">{t("courses.classes", { list: course.class_levels.join("–") })}</Badge>
            <Badge variant="outline">
              <Clock className="size-4" aria-hidden /> {t("courses.minutes", { n: totalMinutes })}
            </Badge>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{course.title}</h1>
          {course.subtitle && <p className="text-xl text-muted-foreground">{course.subtitle}</p>}
          {course.description && <p>{course.description}</p>}

          {course.outcomes.length > 0 && (
            <section aria-labelledby="outcomes-h" className="rounded-2xl bg-secondary p-5 text-secondary-foreground">
              <h2 id="outcomes-h" className="mb-3 text-xl font-bold">
                {t("courses.outcomes")}
              </h2>
              <ul className="space-y-2">
                {course.outcomes.map((o) => (
                  <li key={o} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden /> {o}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="lessons-h">
            <h2 id="lessons-h" className="mb-3 text-2xl font-bold">
              {t("courses.lessonList")}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">{t("courses.activityFirst")}</p>
            <div className="space-y-5">
              {course.modules.map((m) => (
                <div key={m.id}>
                  {course.course_type === "big" && <h3 className="mb-2 font-bold">{m.title}</h3>}
                  <ol className="divide-y rounded-2xl border bg-card">
                    {m.lessons.map((l) => {
                      const open = l.is_preview || course.is_free;
                      return (
                        <li key={l.id} className="flex items-start gap-3 p-4">
                          {open ? (
                            <PlayCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                          ) : (
                            <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                          )}
                          <div className="flex-1">
                            <p className="font-semibold">
                              {l.title}{" "}
                              <span className="sr-only">({open ? (l.is_preview ? t("courses.preview") : t("courses.free")) : t("courses.locked")})</span>
                            </p>
                            {l.summary && <p className="text-sm text-muted-foreground">{l.summary}</p>}
                          </div>
                          {l.is_preview && <Badge variant="accent">{t("courses.preview")}</Badge>}
                          <span className="text-sm whitespace-nowrap text-muted-foreground">{t("courses.minutes", { n: l.estimated_minutes })}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          {course.preview && course.preview.blocks.length > 0 && (
            <section aria-labelledby="preview-h" className="space-y-3">
              <h2 id="preview-h" className="text-2xl font-bold">
                {t("courses.previewActivity")}
              </h2>
              <p className="text-sm text-muted-foreground">{course.preview.lessonTitle}</p>
              <div className="space-y-4 rounded-2xl border-2 border-l-8 border-l-phase-activity bg-card p-5">
                {course.preview.blocks.map((b, i) => (
                  <BlockPreview key={i} block={b} ctx={ctx} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden p-0">
            <CourseCover path={course.cover_image_path} />
            <div className="space-y-4 p-6">
              <p className="text-3xl font-bold">{course.is_free ? t("courses.free") : formatInr(course.price_paise)}</p>
              {course.is_free ? (
                <Button asChild size="lg" className="w-full">
                  <Link href={`/learn/${course.slug}`}>{t("courses.enroll")}</Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="w-full" aria-describedby="enroll-note">
                    <Link href={`/learn/checkout/${course.slug}`}>{t("courses.buy", { price: formatInr(course.price_paise) })}</Link>
                  </Button>
                  <p id="enroll-note" className="text-sm text-muted-foreground">
                    {t("courses.buyNote")}
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/learn/${course.slug}`}>{t("courses.tryPreview")}</Link>
                  </Button>
                </>
              )}
              <p className="text-sm text-muted-foreground">{t("courses.lessons", { n: lessons.length })}</p>
            </div>
          </Card>
        </aside>
      </div>
    </article>
  );
}
