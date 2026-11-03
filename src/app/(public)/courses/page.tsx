import { t } from "@/i18n";

export const metadata = { title: "Courses" };

export default function CoursesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-bold">{t("courses.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("courses.subtitle")}</p>
      <p className="mt-8 rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground">
        {t("courses.empty")}
      </p>
    </div>
  );
}
