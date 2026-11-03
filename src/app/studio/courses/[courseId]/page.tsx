import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { Card, CardTitle } from "@/components/ui/card";
import { CourseForm } from "@/components/studio/course-form";
import { CourseOutline } from "@/components/studio/course-outline";
import { CourseStatusControls, CoverUpload } from "@/components/studio/course-controls";
import { StatusBadge } from "@/components/studio/status-badge";
import { getStudioCourse } from "@/lib/content/studio-queries";
import { mediaUrl } from "@/content/blocks/media";

export const metadata = { title: "Edit course" };

export default async function StudioCoursePage({ params }: PageProps<"/studio/courses/[courseId]">) {
  const { courseId } = await params;
  const course = await getStudioCourse(courseId);
  return (
    <div className="space-y-6">
      <Link href="/studio" className="inline-flex min-h-11 items-center gap-2 font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-5" aria-hidden /> All courses
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={course.title} description={`/courses/${course.slug}`} />
        <div className="flex items-center gap-3">
          <StatusBadge status={course.status} />
          {course.status === "published" && (
            <Link href={`/courses/${course.slug}`} className="inline-flex min-h-11 items-center gap-1 font-medium text-primary" target="_blank">
              View <ExternalLink className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="outline-h" className="space-y-3">
          <h2 id="outline-h" className="text-xl font-bold">
            Modules & lessons
          </h2>
          <CourseOutline
            courseId={course.id}
            initialModules={course.modules.map((m) => ({
              id: m.id,
              title: m.title,
              lessons: m.lessons.map((l) => ({
                id: l.id,
                slug: l.slug,
                title: l.title,
                published_version_id: l.published_version_id,
                is_preview: l.is_preview,
              })),
            }))}
          />
        </section>
        <aside className="space-y-4">
          <Card>
            <CardTitle>Status</CardTitle>
            <p className="text-sm text-muted-foreground">Publishing needs at least one published lesson. Students only ever see published lesson versions.</p>
            <CourseStatusControls courseId={course.id} status={course.status} />
          </Card>
          <Card>
            {course.cover_image_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(course.cover_image_path)} alt="" className="aspect-video w-full rounded-xl object-cover" />
            )}
            <CoverUpload courseId={course.id} />
          </Card>
        </aside>
      </div>

      <section aria-labelledby="details-h">
        <h2 id="details-h" className="mb-3 text-xl font-bold">
          Course details
        </h2>
        <Card>
          <CourseForm course={course} />
        </Card>
      </section>
    </div>
  );
}
