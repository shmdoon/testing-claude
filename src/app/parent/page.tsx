import { PageHeader } from "@/components/layout/area-shell";
import { Card, CardDescription } from "@/components/ui/card";
import { t } from "@/i18n";

export const metadata = { title: "Parent" };

export default function ParentHome() {
  return (
    <div>
      <PageHeader title={t("parent.title")} />
      <Card>
        <CardDescription>{t("parent.empty")}</CardDescription>
      </Card>
    </div>
  );
}
