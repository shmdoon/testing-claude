"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import type { AppRole } from "@/lib/auth/roles";
import { sendWhatsApp } from "@/lib/whatsapp/send";

export type ReviewState = { ok?: boolean; message?: string; error?: string };
const uuid = z.uuid();

/** Approve / ask for a revision. Runs as the reviewer: the SQL function checks staff + audits. */
export async function reviewSubmission(id: string, status: "approved" | "needs_revision", feedback: string): Promise<ReviewState> {
  await requireArea("studio");
  if (!uuid.safeParse(id).success) return { error: "Invalid submission." };
  const fb = z.string().trim().max(2000).safeParse(feedback);
  if (!fb.success) return { error: "Feedback is too long." };
  if (status === "needs_revision" && !fb.data) return { error: "Tell the student what to change." };
  const { data, error } = await (await createClient()).rpc("review_submission", { p_submission_id: id, p_status: status, p_feedback: fb.data });
  if (error) return { error: error.code === "42501" ? "You can't review submissions." : "Couldn't save the review." };
  await notifyParentOfReview(id, status, fb.data).catch((e) => console.error("feedback WhatsApp failed", e));
  // No revalidation here: the reviewed card stays put (showing its outcome) so the
  // teacher keeps their place in the queue; the list refreshes on the next visit.
  return { ok: true, message: status === "approved" ? (data === "completed" ? "Approved — lesson completed." : "Approved.") : "Sent back with feedback." };
}

/** Moderation: remove an approved project from the gallery. */
export async function hideFromGallery(id: string): Promise<ReviewState> {
  const user = await requireArea("studio");
  if (!uuid.safeParse(id).success) return { error: "Invalid submission." };
  await createAdminClient().from("external_submissions").update({ share_in_gallery: false }).eq("id", id);
  await writeAudit({ actorId: user.id, action: "gallery.removed", targetType: "external_submission", targetId: id });
  revalidatePath("/studio/submissions");
  return { ok: true, message: "Removed from the gallery." };
}

/** Admin role management (audited inside admin_set_role). */
export async function changeRole(userId: string, role: AppRole): Promise<ReviewState> {
  await requireArea("admin");
  if (!uuid.safeParse(userId).success || !["student", "parent", "content_editor", "admin"].includes(role)) return { error: "Invalid." };
  const { error } = await (await createClient()).rpc("admin_set_role", { p_user_id: userId, p_role: role });
  if (error) return { error: error.message.includes("own role") ? "You can't change your own role." : "Couldn't change the role." };
  revalidatePath("/admin/users");
  return { ok: true, message: "Role updated." };
}

/** Teacher feedback → the parent's WhatsApp (if they opted in). */
async function notifyParentOfReview(submissionId: string, status: "approved" | "needs_revision", feedback: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("external_submissions")
    .select("user_id, lessons(title), profiles!external_submissions_user_id_fkey(full_name, parent_phone, parent_whatsapp_opt_in)")
    .eq("id", submissionId)
    .single();
  const p = data?.profiles;
  if (!data || !p?.parent_phone || !p.parent_whatsapp_opt_in) return;
  await sendWhatsApp({
    to: p.parent_phone,
    template: "project_feedback",
    params: [
      (p.full_name ?? "Your child").split(" ")[0]!,
      data.lessons?.title ?? "a lesson",
      status === "approved" ? "approved" : "sent back for a small change",
      feedback ? `Teacher's note: "${feedback.slice(0, 500)}"` : "No extra notes.",
    ],
    studentId: data.user_id,
    related: { type: "external_submission", id: submissionId },
  });
}
