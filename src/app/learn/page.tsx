import Link from "next/link";
import { Hourglass } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { requireArea } from "@/lib/auth/dal";
import { t } from "@/i18n";

export const metadata = { title: "Dashboard" };

export default async function LearnDashboard() {
  const { profile } = await requireArea("learn", "/learn");
  const name = profile.full_name?.split(" ")[0];
  return (
    <div className="space-y-6">
      <PageHeader title={name ? t("learn.welcome", { name }) : t("learn.welcomeFallback")} />
      {profile.account_status === "pending_consent" && (
        <div role="status" className="flex gap-3 rounded-2xl border-2 border-warning/60 bg-warning/15 p-4">
          <Hourglass className="mt-0.5 size-6 shrink-0" aria-hidden />
          <p>{t("learn.pendingConsent")}</p>
        </div>
      )}
      <Card className="items-start">
        <CardDescription>{t("learn.dashboardEmpty")}</CardDescription>
        <Button asChild>
          <Link href="/courses">{t("learn.browse")}</Link>
        </Button>
      </Card>
    </div>
  );
}
