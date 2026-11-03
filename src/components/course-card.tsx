import Image from "next/image";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mediaUrl } from "@/content/blocks/media";
import { formatInr } from "@/lib/format";
import type { CatalogCourse } from "@/lib/content/catalog";
import { t } from "@/i18n";

export function CourseCover({ path, className }: { path: string | null; className?: string }) {
  if (!path) {
    return (
      <div className={`grid aspect-video place-items-center bg-secondary text-secondary-foreground ${className ?? ""}`}>
        <BookOpen className="size-10" aria-hidden />
      </div>
    );
  }
  const src = mediaUrl(path);
  return (
    <Image
      src={src}
      alt=""
      width={640}
      height={360}
      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      unoptimized={src.endsWith(".svg")}
      className={`aspect-video w-full object-cover ${className ?? ""}`}
    />
  );
}

export function CourseCard({ course }: { course: CatalogCourse }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <CourseCover path={course.cover_image_path} />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{course.course_type === "mini" ? t("courses.mini") : t("courses.big")}</Badge>
          <Badge variant="outline">{t("courses.classes", { list: course.class_levels.join("–") })}</Badge>
        </div>
        <h3 className="text-xl font-bold group-hover:text-primary">{course.title}</h3>
        {course.subtitle && <p className="text-muted-foreground">{course.subtitle}</p>}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">{t("courses.lessons", { n: course.lesson_count })}</span>
          <span className="text-lg font-bold">{course.is_free ? t("courses.free") : formatInr(course.price_paise)}</span>
        </div>
      </div>
    </Link>
  );
}
