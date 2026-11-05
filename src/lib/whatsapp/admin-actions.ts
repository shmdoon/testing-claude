"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { sendWeeklySummaries } from "./weekly";

const uuid = z.uuid();

/** After sending by hand via click-to-chat, mark the outbox item done. */
export async function markWhatsAppSent(id: string, status: "manual_sent" | "cancelled") {
  const user = await requireArea("admin");
  if (!uuid.safeParse(id).success) return { error: "Invalid." };
  await createAdminClient()
    .from("whatsapp_messages")
    .update({ status, sent_at: status === "manual_sent" ? new Date().toISOString() : null, sent_by: user.id })
    .eq("id", id)
    .in("status", ["manual", "failed"]);
  // No revalidate: the row stays in place showing "Marked as sent" so the list doesn't jump while working through it.
  return { ok: true };
}

export async function runWeeklySummaryNow() {
  const user = await requireArea("admin");
  const r = await sendWeeklySummaries();
  await writeAudit({ actorId: user.id, action: "whatsapp.weekly_summary_run", metadata: r });
  revalidatePath("/admin/whatsapp");
  return r;
}
