import Link from "next/link";
import { LessonPlayer } from "@/components/player/lesson-player";
import { getPlayerData } from "@/lib/learn/queries";
import { t } from "@/i18n";

export const metadata = { title: "Lesson" };

export default async function LessonPage({ params }: PageProps<"/learn/[courseSlug]/[lessonSlug]">) {
  const { courseSlug, lessonSlug } = await params;
  const data = await getPlayerData(courseSlug, lessonSlug);

  if (data.kind === "blocked") {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border-2 bg-card p-6 text-center">
        <h1 className="text-2xl font-bold">{t(`learn.blocked_${data.reason}` as never)}</h1>
        <Link href={`/learn/${data.course.slug}`} className="font-semibold text-primary underline">
          {t("player.backToCourse")}
        </Link>
      </div>
    );
  }

  const { user: _user, kind: _kind, ...props } = data;
  void _user;
  void _kind;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`/learn/${data.course.slug}`} className="inline-flex min-h-11 items-center font-medium text-muted-foreground hover:text-foreground">
        ← {data.course.title}
      </Link>
      <h1 className="text-3xl font-bold">{data.lesson.title}</h1>
      <LessonPlayer {...props} />
    </div>
  );
}
