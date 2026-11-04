import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { formatDuration } from "@/components/charts/scale";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getStudentStats } from "@/lib/learn/stats";
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
  const kids = await Promise.all((links ?? []).map(async (l) => ({ ...l, stats: await getStudentStats(supabase, l.student_id, 7) })));

  return (
    <div className="space-y-6">
      <PageHeader title={t("parent.title")} />
      {!kids.length ? (
        <Card>
          <CardDescription>{t("parent.empty")}</CardDescription>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {kids.map((k) => {
            const done = k.stats.courses.reduce((s, c) => s + c.done, 0);
            const total = k.stats.courses.reduce((s, c) => s + c.total, 0);
            return (
              <li key={k.student_id}>
                <Link
                  href={`/parent/children/${k.student_id}`}
                  className="block space-y-3 rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  data-testid="child-card"
                >
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-xl font-bold">{k.profiles?.full_name}</p>
                    <Badge variant={k.profiles?.account_status === "active" ? "success" : "warning"}>
                      {k.profiles?.account_status === "active" ? t("parent.approved") : t("parent.awaitingApproval")}
                    </Badge>
                    <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">{t("parent.thisWeek")}</dt>
                      <dd className="text-lg font-semibold">{formatDuration(k.stats.weekActiveSeconds)}</dd>
                      {k.stats.weekExternalSeconds > 0 && <dd className="text-xs text-muted-foreground">+{formatDuration(k.stats.weekExternalSeconds)} {t("parent.estimatedElsewhere")}</dd>}
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("parent.lessonsDone")}</dt>
                      <dd className="text-lg font-semibold">
                        {done}
                        {total ? ` / ${total}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t("learn.streak")}</dt>
                      <dd className="flex items-center gap-1 text-lg font-semibold">
                        <Flame className="size-4 text-coral" aria-hidden /> {k.stats.streak}
                      </dd>
                    </div>
                  </dl>
                  {k.stats.courses.map((c) => (
                    <div key={c.id} className="space-y-1">
                      <p className="text-sm font-medium">{c.title}</p>
                      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={c.title} aria-valuenow={c.total ? Math.round((c.done / c.total) * 100) : 0} aria-valuemin={0} aria-valuemax={100}>
                        <div className="h-full rounded-full bg-success" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Button asChild variant="outline">
        <Link href="/courses?price=paid">{t("parent.browsePaid")}</Link>
      </Button>
    </div>
  );
}
