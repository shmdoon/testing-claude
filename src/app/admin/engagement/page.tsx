import { Download } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/area-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DailyChart } from "@/components/charts/daily-chart";
import { formatDuration } from "@/components/charts/scale";
import { getEngagement, parseEngagement } from "@/lib/reports/admin";
import { addDays, istDate } from "@/lib/reports/days";

export const metadata = { title: "Engagement" };

export default async function EngagementPage({ searchParams }: PageProps<"/admin/engagement">) {
  const f = parseEngagement(await searchParams);
  const { rows, series } = await getEngagement(f);
  const qs = (patch: Record<string, string>) => new URLSearchParams({ ...f, ...patch }).toString();
  const today = istDate();
  const input = "h-11 rounded-lg border-2 border-input bg-background px-3 block";
  const totalActive = rows.reduce((s, r) => s + Number(r.active_seconds), 0);
  const totalExt = rows.reduce((s, r) => s + Number(r.external_seconds), 0);
  return (
    <div className="space-y-5">
      <PageHeader title="Engagement" description="Active time is measured on the platform; time on other websites is an estimate (launch → return, capped)." />
      {/* One filter row above everything it scopes; presets first. */}
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap gap-2" aria-label="Date presets">
          {[7, 30, 90].map((n) => (
            <Button key={n} asChild size="sm" variant={f.from === addDays(today, -(n - 1)) && f.to === today ? "secondary" : "outline"}>
              <Link href={`/admin/engagement?${qs({ from: addDays(today, -(n - 1)), to: today })}`}>Last {n} days</Link>
            </Button>
          ))}
        </div>
        <label className="space-y-1 text-sm">
          <span className="font-medium">From</span>
          <input type="date" name="from" defaultValue={f.from} className={input} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">To</span>
          <input type="date" name="to" defaultValue={f.to} className={input} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Group by</span>
          <select name="group" defaultValue={f.group} className={input} key={f.group}>
            <option value="student">Student</option>
            <option value="course">Course</option>
            <option value="lesson">Lesson</option>
          </select>
        </label>
        <Button type="submit">Apply</Button>
        <Button asChild variant="outline">
          <a href={`/api/admin/engagement-csv?${qs({})}`}>
            <Download aria-hidden /> CSV
          </a>
        </Button>
      </form>
      <Card>
        <DailyChart
          title="Learning time across the platform"
          unit="min"
          series={[
            { label: "Active on the platform", color: "chart-1" },
            { label: "On other websites (estimated)", color: "chart-2" },
          ]}
          data={series}
        />
      </Card>
      <p className="text-sm text-muted-foreground">
        Total: <strong>{formatDuration(totalActive)}</strong> active · {formatDuration(totalExt)} estimated elsewhere
      </p>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {[f.group === "student" ? "Student" : f.group === "course" ? "Course" : "Lesson", "Students", "Active time", "Avg per student", "Estimated elsewhere", "Lessons completed"].map((h) => (
                <th key={h} scope="col" className="p-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.key_id} className="border-b last:border-0" data-testid="engagement-row">
                <td className="p-3">
                  {f.group === "student" ? (
                    <Link href={`/admin/students/${r.key_id}`} className="font-medium underline">
                      {r.label}
                    </Link>
                  ) : (
                    <span className="font-medium">{r.label}</span>
                  )}
                  {r.detail && <span className="block text-xs text-muted-foreground">{r.detail}</span>}
                </td>
                <td className="p-3">{r.students}</td>
                <td className="p-3">{formatDuration(Number(r.active_seconds))}</td>
                <td className="p-3">{formatDuration(r.students ? Number(r.active_seconds) / r.students : 0)}</td>
                <td className="p-3">{formatDuration(Number(r.external_seconds))}</td>
                <td className="p-3">{r.lessons_completed}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No activity in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
