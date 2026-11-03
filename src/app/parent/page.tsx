import Link from "next/link";
import { PageHeader } from "@/components/layout/area-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/i18n";

export const metadata = { title: "Parent" };

export default async function ParentHome() {
  const user = await requireArea("parent", "/parent");
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("parent_student_links")
    .select("student_id, profiles!parent_student_links_student_id_fkey(full_name, class_level, account_status)")
    .eq("parent_id", user.id)
    .eq("status", "active");
  return (
    <div className="space-y-6">
      <PageHeader title={t("parent.title")} />
      {!links?.length ? (
        <Card>
          <CardDescription>{t("parent.empty")}</CardDescription>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {links.map((l) => (
            <li key={l.student_id}>
              <Card>
                <p className="text-lg font-bold">{l.profiles?.full_name}</p>
                <CardDescription>{t("auth.classOption", { n: l.profiles?.class_level ?? "?" })}</CardDescription>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="outline">
        <Link href="/courses?price=paid">{t("parent.browsePaid")}</Link>
      </Button>
    </div>
  );
}
