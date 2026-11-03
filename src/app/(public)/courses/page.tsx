import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/course-card";
import { getPublishedCourses } from "@/lib/content/catalog";
import { filterCourses, parseFilters, type CatalogFilters } from "@/lib/content/filters";
import { t } from "@/i18n";

export const metadata = { title: "Courses" };

export default function CoursesPage({ searchParams }: PageProps<"/courses">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
      <h1 className="text-4xl font-bold">{t("courses.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("courses.subtitle")}</p>
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Catalog({ searchParams }: { searchParams: PageProps<"/courses">["searchParams"] }) {
  const [courses, sp] = await Promise.all([getPublishedCourses(), searchParams]);
  const filters = parseFilters(sp);
  const subjects = [...new Set(courses.map((c) => c.subject))].sort();
  const shown = filterCourses(courses, filters);
  return (
    <>
      <FilterBar filters={filters} subjects={subjects} />
      {shown.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground">{t("courses.empty")}</p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <li key={c.id}>
              <CourseCard course={c} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Plain GET form: works without JavaScript and on slow connections. */
function FilterBar({ filters, subjects }: { filters: CatalogFilters; subjects: string[] }) {
  const select = "h-12 w-full rounded-lg border-2 border-input bg-background px-3";
  return (
    <form method="get" className="mt-6 grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-5 sm:items-end" aria-label={t("courses.filters")}>
      <label className="space-y-1">
        <span className="text-sm font-medium">{t("courses.filterClass")}</span>
        <select name="class" defaultValue={filters.class ?? ""} className={select}>
          <option value="">{t("courses.any")}</option>
          {[7, 8].map((n) => (
            <option key={n} value={n}>
              {t("auth.classOption", { n })}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">{t("courses.filterType")}</span>
        <select name="type" defaultValue={filters.type ?? ""} className={select}>
          <option value="">{t("courses.any")}</option>
          <option value="mini">{t("courses.mini")}</option>
          <option value="big">{t("courses.big")}</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">{t("courses.filterPrice")}</span>
        <select name="price" defaultValue={filters.price ?? ""} className={select}>
          <option value="">{t("courses.any")}</option>
          <option value="free">{t("courses.free")}</option>
          <option value="paid">{t("courses.paid")}</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">{t("courses.filterSubject")}</span>
        <select name="subject" defaultValue={filters.subject ?? ""} className={select}>
          <option value="">{t("courses.any")}</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {t("courses.apply")}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/courses">{t("courses.clear")}</Link>
        </Button>
      </div>
    </form>
  );
}

function CatalogSkeleton() {
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label={t("common.loading")}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-80 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}
