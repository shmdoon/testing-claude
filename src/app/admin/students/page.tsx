import Link from "next/link";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/components/charts/scale";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: PageProps<"/admin/students">) {
  await requireArea("admin");
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 80) || null;
  const { data: rows, error } = await (await createClient()).rpc("admin_students", { p_search: q as string });
  if (error) throw error;
  return (
    <div className="space-y-5">
      <PageHeader title="Students" description="Sorted by most recently active." />
      <form method="get" className="flex gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="Search name or email" aria-label="Search students" className="h-11 flex-1 rounded-lg border-2 border-input bg-background px-3" />
        <Button type="submit">Search</Button>
      </form>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {["Student", "Class", "Courses", "Active time", "Last active", "Completion"].map((h) => (
                <th key={h} scope="col" className="p-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-b last:border-0" data-testid="student-row">
                <td className="p-3">
                  <Link href={`/admin/students/${r.id}`} className="font-semibold text-primary underline">
                    {r.full_name ?? r.email}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{r.email}</span>
                  {r.account_status !== "active" && <Badge variant="warning">{r.account_status.replace("_", " ")}</Badge>}
                </td>
                <td className="p-3">{r.class_level ?? "—"}</td>
                <td className="p-3">{r.courses}</td>
                <td className="p-3">
                  {formatDuration(Number(r.total_seconds))}
                  {Number(r.external_seconds) > 0 && <span className="block text-xs text-muted-foreground">+{formatDuration(Number(r.external_seconds))} est. elsewhere</span>}
                </td>
                <td className="p-3">{r.last_active ? new Date(r.last_active).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</td>
                <td className="p-3">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className="block h-full rounded-full bg-success" style={{ width: `${r.completion_pct}%` }} />
                    </span>
                    {r.completion_pct}% <span className="text-xs text-muted-foreground">({r.lessons_done}/{r.lessons_total})</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
