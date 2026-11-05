"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea, requireUser } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { completeDeletion } from "./service";

export type PrivacyState = { ok?: boolean; message?: string; error?: string };
const uuid = z.uuid();

/** A student asks for their account and data to be deleted. */
export async function requestMyDeletion(_prev: PrivacyState, form: FormData): Promise<PrivacyState> {
  const user = await requireUser();
  if (user.profile.role !== "student") return { error: "Staff accounts are removed by an admin." };
  if (form.get("confirm") !== "on") return { error: "Tick the box to confirm." };
  if (!(await rateLimit(`privacy:request:${user.id}`, 5, 3600))) return { error: "Please try again later." };
  const note = z.string().trim().max(500).catch("").parse(form.get("reason") ?? "");
  const { error } = await createAdminClient()
    .from("deletion_requests")
    .insert({ student_id: user.id, subject_id: user.id, source: "student", requested_by: user.id, note: note || null });
  if (error && error.code !== "23505") return { error: "Couldn't send the request." };
  await writeAudit({ actorId: user.id, action: "privacy.deletion_requested", targetType: "profile", targetId: user.id });
  revalidatePath("/learn/profile");
  return { ok: true, message: "Request sent. We'll confirm with your parent and delete your data within 30 days." };
}

export async function cancelMyDeletion(): Promise<PrivacyState> {
  const user = await requireUser();
  await createAdminClient()
    .from("deletion_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("subject_id", user.id)
    .eq("status", "pending");
  await writeAudit({ actorId: user.id, action: "privacy.deletion_cancelled", targetType: "profile", targetId: user.id });
  revalidatePath("/learn/profile");
  return { ok: true, message: "Cancelled — your account stays." };
}

/** Admin records a parent's deletion request (e.g. received on WhatsApp). */
export async function adminRequestDeletion(studentId: string, note: string): Promise<PrivacyState> {
  const admin = await requireArea("admin");
  if (!uuid.safeParse(studentId).success) return { error: "Invalid." };
  const n = note.trim();
  if (n.length < 5) return { error: "Write how the parent asked (e.g. 'WhatsApp, 5 Nov')." };
  const db = createAdminClient();
  const { data: p } = await db.from("profiles").select("role").eq("id", studentId).maybeSingle();
  if (p?.role !== "student") return { error: "Only student accounts." };
  const { error } = await db
    .from("deletion_requests")
    .insert({ student_id: studentId, subject_id: studentId, source: "admin", requested_by: admin.id, note: n.slice(0, 500) });
  if (error) return { error: error.code === "23505" ? "A request is already pending." : "Couldn't create the request." };
  await writeAudit({ actorId: admin.id, action: "privacy.deletion_requested", targetType: "profile", targetId: studentId });
  revalidatePath("/admin/deletions");
  return { ok: true, message: "Request added to the deletion queue." };
}

/** Admin confirms and erases. Irreversible. */
export async function adminCompleteDeletion(requestId: string): Promise<PrivacyState> {
  const admin = await requireArea("admin");
  if (!uuid.safeParse(requestId).success) return { error: "Invalid." };
  try {
    const out = await completeDeletion(requestId, admin.id);
    // No revalidate: the row stays with its confirmation until the admin reloads the queue.
    return {
      ok: true,
      message: out.mode === "deleted" ? "Account and data deleted." : "Data deleted. Invoices are kept for tax law; the login is permanently disabled.",
    };
  } catch (e) {
    console.error("erase failed", e);
    return { error: "Couldn't complete the deletion — nothing was marked done. Try again." };
  }
}

export async function adminCancelDeletion(requestId: string): Promise<PrivacyState> {
  const admin = await requireArea("admin");
  if (!uuid.safeParse(requestId).success) return { error: "Invalid." };
  await createAdminClient()
    .from("deletion_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending");
  await writeAudit({ actorId: admin.id, action: "privacy.deletion_cancelled", targetType: "deletion_request", targetId: requestId });
  return { ok: true, message: "Cancelled." };
}
