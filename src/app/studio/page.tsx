import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listStudioCourses } from "@/lib/content/studio-queries";
import { formatInr } from "@/lib/format";
import { StatusBadge } from "@/components/studio/status-badge";
import { t } from "@/i18n";

export const metadata = { title: "Content Studio" };

export default async function StudioHome() {
  const courses = await listStudioCourses();
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={t("studio.title")} description={t("studio.subtitle")} />
        <Button asChild>
          <Link href="/studio/courses/new">
            <Plus aria-hidden /> {t("studio.newCourse")}
          </Link>
        </Button>
      </div>
      {courses.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground">{t("studio.noCourses")}</p>
      ) : (
        <ul className="grid gap-3">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/studio/courses/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <div>
                  <p className="text-lg font-bold">{c.title}</p>
                  <p className="text-sm text-muted-foreground">
                    /{c.slug} · {c.lessons[0]?.count ?? 0} lessons · {c.is_free ? t("courses.free") : formatInr(c.price_paise)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{c.course_type === "mini" ? t("courses.mini") : t("courses.big")}</Badge>
                  <StatusBadge status={c.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
