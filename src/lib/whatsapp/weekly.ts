import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, istDate } from "@/lib/reports/days";
import { streak } from "@/lib/learn/badges";
import { formatDuration } from "@/components/charts/scale";
import { sendWhatsApp } from "./send";

export type WeeklyResult = { considered: number; sent: number; queued: number; skipped: number };

/** Plain summary line pieces (pure, unit-tested). */
export function weeklyHighlight(lessons: number, minutes: number): string {
  if (lessons > 0) return "Great progress — keep it up!";
  if (minutes > 0) return "Nice effort this week. Finishing one lesson next week will unlock a badge.";
  return "No learning this week — a 10-minute lesson is a great way to restart.";
}

/**
 * Weekly progress summary to each opted-in parent (one per child per week).
 * Idempotent: a child already summarised this week is skipped.
 */
export async function sendWeeklySummaries(): Promise<WeeklyResult> {
  const admin = createAdminClient();
  const today = istDate();
  const from = addDays(today, -6);
  const weekKey = `${from}..${today}`;
  const { data: students } = await admin
    .from("profiles")
    .select("id, full_name, parent_phone")
    .eq("role", "student")
    .eq("account_status", "active")
    .eq("parent_whatsapp_opt_in", true)
    .not("parent_phone", "is", null);

  const out: WeeklyResult = { considered: students?.length ?? 0, sent: 0, queued: 0, skipped: 0 };
  for (const s of students ?? []) {
    const relatedId = `${s.id}:${weekKey}`;
    const { count } = await admin.from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("template", "weekly_summary").eq("related_id", relatedId);
    if (count) {
      out.skipped++;
      continue;
    }
    const [{ data: days }, { count: lessons }] = await Promise.all([
      admin.from("activity_minutes").select("date, seconds").eq("user_id", s.id).gte("date", addDays(today, -60)),
      admin.from("lesson_progress").select("id", { count: "exact", head: true }).eq("user_id", s.id).eq("status", "completed").gte("completed_at", `${from}T00:00:00+05:30`),
    ]);
    const active = (days ?? []).filter((d) => d.seconds > 0);
    const weekSeconds = active.filter((d) => d.date >= from).reduce((n, d) => n + d.seconds, 0);
    const r = await sendWhatsApp({
      to: s.parent_phone!,
      template: "weekly_summary",
      params: [
        (s.full_name ?? "Your child").split(" ")[0]!,
        formatDuration(weekSeconds),
        String(lessons ?? 0),
        String(streak([...new Set(active.map((d) => d.date))], today)),
        weeklyHighlight(lessons ?? 0, Math.round(weekSeconds / 60)),
      ],
      studentId: s.id,
      related: { type: "weekly_summary", id: relatedId },
    });
    if (r.status === "sent") out.sent++;
    else out.queued++;
  }
  return out;
}
