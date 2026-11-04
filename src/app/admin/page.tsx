import Link from "next/link";
import { PageHeader } from "@/components/layout/area-shell";
import { Card, CardTitle } from "@/components/ui/card";
import { DailyChart, StatTile } from "@/components/charts/daily-chart";
import { formatDuration } from "@/components/charts/scale";
import { getOverview } from "@/lib/reports/admin";
import { formatInr } from "@/lib/format";

export const metadata = { title: "Admin" };

export default async function AdminHome() {
  const o = await getOverview();
  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Days and months are India time." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active students today" value={String(o.active_today)} sub={`${o.active_week} this week · ${o.students_total} students`} />
        <StatTile label="Revenue this month" value={formatInr(o.revenue_month_paise)} sub={`${o.orders_month} orders${o.test_revenue_month_paise ? ` · ${formatInr(o.test_revenue_month_paise)} test` : ""}`} />
        <StatTile label="Avg time per active student" value={formatDuration(o.avg_seconds_per_active_student_week)} sub="this week" />
        <StatTile label="Waiting for review" value={String(o.submissions_waiting)} sub={`${o.leads_week} new leads this week · ${o.students_pending_consent} awaiting consent`} />
      </div>
      <Card>
        <DailyChart title="Active students per day, last 30 days" unit="students" integer series={[{ label: "Active students", color: "chart-1" }]} data={o.daily.map((d) => ({ date: d.date.slice(0, 10), values: [d.students] }))} />
      </Card>
      <Card>
        <CardTitle>Top courses</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b">
              <tr>
                {["Course", "Enrolled", "Lessons completed", "Learning time (30 days)"].map((h) => (
                  <th key={h} scope="col" className="p-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {o.top_courses.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-2">
                    <Link href={`/courses/${c.slug}`} className="font-medium underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="p-2">{c.enrolled}</td>
                  <td className="p-2">{c.lessons_completed}</td>
                  <td className="p-2">{formatDuration(c.seconds_30d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
