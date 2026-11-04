import { Flame } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { BadgeGrid } from "@/components/dashboard/badges";
import { DailyChart, StatTile } from "@/components/charts/daily-chart";
import { formatDuration } from "@/components/charts/scale";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getStudentStats } from "@/lib/learn/stats";

export const metadata = { title: "Achievements" };

export default async function AchievementsPage() {
  const user = await requireArea("learn", "/learn/achievements");
  const s = await getStudentStats(await createClient(), user.id, 14);
  const earned = s.badges.filter((b) => b.earned).length;
  return (
    <div className="space-y-6">
      <PageHeader title="Achievements" description={`${earned} of ${s.badges.length} badges earned`} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <Flame className="size-10 text-coral" aria-hidden />
          <div>
            <p className="text-sm text-muted-foreground">Current streak</p>
            <p className="text-3xl font-semibold" data-testid="streak">
              {s.streak} {s.streak === 1 ? "day" : "days"}
            </p>
          </div>
        </div>
        <StatTile label="Lessons completed" value={String(s.lessonsCompleted)} />
        <StatTile label="Total learning time" value={formatDuration(s.totalSeconds)} sub={`Best streak: ${s.bestStreak} days`} />
      </div>
      <div className="rounded-2xl border bg-card p-4">
        <DailyChart
          title="Your learning time, last 14 days"
          unit="min"
          series={[
            { label: "Active on the platform", color: "chart-1" },
            { label: "On other websites (estimated)", color: "chart-2" },
          ]}
          data={s.daily}
        />
      </div>
      <section aria-labelledby="badges-h" className="space-y-3">
        <h2 id="badges-h" className="text-2xl font-bold">
          Badges
        </h2>
        <BadgeGrid badges={s.badges} />
      </section>
    </div>
  );
}
