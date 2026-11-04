import "server-only";
import { z } from "zod";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { addDays, fillDays, istDate } from "./days";

export type Overview = {
  students_total: number;
  students_pending_consent: number;
  active_today: number;
  active_week: number;
  avg_seconds_per_active_student_week: number;
  revenue_month_paise: number;
  test_revenue_month_paise: number;
  orders_month: number;
  submissions_waiting: number;
  leads_week: number;
  daily: { date: string; students: number; seconds: number }[];
  top_courses: { id: string; title: string; slug: string; enrolled: number; lessons_completed: number; seconds_30d: number }[];
};

export async function getOverview(): Promise<Overview> {
  await requireArea("admin");
  const { data, error } = await (await createClient()).rpc("admin_overview");
  if (error) throw error;
  return data as unknown as Overview;
}

export const engagementSchema = z.object({
  from: z.iso.date().catch(addDays(istDate(), -29)),
  to: z.iso.date().catch(istDate()),
  group: z.enum(["student", "course", "lesson"]).catch("student"),
});
export type EngagementFilters = z.infer<typeof engagementSchema>;

export function parseEngagement(sp: Record<string, string | string[] | undefined>): EngagementFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const f = engagementSchema.parse({ from: one(sp.from) ?? addDays(istDate(), -29), to: one(sp.to) ?? istDate(), group: one(sp.group) ?? "student" });
  if (f.from > f.to) return { ...f, from: f.to };
  return f;
}

export async function getEngagement(f: EngagementFilters) {
  await requireArea("admin");
  const supabase = await createClient();
  const [{ data: rows, error }, { data: daily }] = await Promise.all([
    supabase.rpc("admin_engagement", { p_from: f.from, p_to: f.to, p_group: f.group }),
    supabase.from("daily_activity").select("date, active_seconds, estimated_external_seconds").gte("date", f.from).lte("date", f.to),
  ]);
  if (error) throw error;
  const byDate = new Map<string, { date: string; a: number; e: number }>();
  for (const d of daily ?? []) {
    const r = byDate.get(d.date!) ?? { date: d.date!, a: 0, e: 0 };
    r.a += d.active_seconds ?? 0;
    r.e += d.estimated_external_seconds ?? 0;
    byDate.set(d.date!, r);
  }
  const series = fillDays(f.from, f.to, [...byDate.values()], (r) => [Math.round((r?.a ?? 0) / 60), Math.round((r?.e ?? 0) / 60)]);
  return { rows: rows ?? [], series };
}
