import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { Card, CardTitle } from "@/components/ui/card";
import { LessonEditor } from "@/components/studio/lesson-editor";
import { LessonSettingsForm } from "@/components/studio/lesson-settings-form";
import { getStudioLesson } from "@/lib/content/studio-queries";

export const metadata = { title: "Edit lesson" };

export default async function StudioLessonPage({ params }: PageProps<"/studio/courses/[courseId]/lessons/[lessonId]">) {
  const { courseId, lessonId } = await params;
  const { lesson, draft, published, current, tools } = await getStudioLesson(courseId, lessonId);
  const initialBlocks = (draft?.blocks ?? current?.blocks ?? []) as unknown[];
  return (
    <div className="space-y-6">
      <Link
        href={`/studio/courses/${courseId}`}
        className="inline-flex min-h-11 items-center gap-2 font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-5" aria-hidden /> {lesson.courses?.title}
      </Link>
      <PageHeader
        title={lesson.title}
        description={`${lesson.modules?.title} · ${draft ? "draft in progress" : current ? `live: v${published[0]?.version}` : "not published"}`}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <LessonEditor
          lessonId={lesson.id}
          initialBlocks={initialBlocks}
          tools={tools}
          versions={published.map((v) => ({
            id: v.id,
            version: v.version!,
            published_at: v.published_at!,
            blocks: v.blocks as unknown[],
          }))}
        />
        <aside>
          <Card>
            <CardTitle>Lesson settings</CardTitle>
            <LessonSettingsForm courseId={courseId} lesson={lesson} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
