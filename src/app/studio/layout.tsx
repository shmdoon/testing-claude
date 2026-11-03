import { BookOpen } from "lucide-react";
import { AreaShell } from "@/components/layout/area-shell";
import { t } from "@/i18n";

export default function StudioLayout({ children }: LayoutProps<"/studio">) {
  return (
    <AreaShell
      area="studio"
      label={t("studio.title")}
      nav={[{ href: "/studio", label: t("nav.studioCourses"), icon: <BookOpen /> }]}
    >
      {children}
    </AreaShell>
  );
}
