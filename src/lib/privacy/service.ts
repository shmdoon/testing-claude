import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import type { Json } from "@/lib/supabase/database.types";

import { PENDING_RETENTION_DAYS } from "./constants";

export { PENDING_RETENTION_DAYS };
const SUBMISSIONS_BUCKET = process.env.SUPABASE_SUBMISSIONS_BUCKET || "submissions";
const BAN = "876000h"; // ~100 years

export type EraseOutcome = { mode: "deleted" | "anonymised"; deleted: Record<string, number>; files: number };

async function removeFiles(userId: string): Promise<number> {
  const storage = createAdminClient().storage.from(SUBMISSIONS_BUCKET);
  let removed = 0;
  for (;;) {
    const { data } = await storage.list(userId, { limit: 100 });
    if (!data?.length) return removed;
    const paths = data.map((f) => `${userId}/${f.name}`);
    const { error } = await storage.remove(paths);
    if (error) throw new Error(`could not remove files: ${error.message}`);
    removed += paths.length;
  }
}

/**
 * Erase a student's personal data. Invoices/orders must be kept for tax law, so
 * an account with orders is anonymised and its login permanently disabled;
 * otherwise the login is deleted outright (profile cascades).
 */
export async function eraseStudent(studentId: string): Promise<EraseOutcome> {
  const admin = createAdminClient();
  const files = await removeFiles(studentId);
  const { data, error } = await admin.rpc("erase_student", { p_student: studentId });
  if (error) throw new Error(`erase failed: ${error.message}`);
  const out = data as { has_orders: boolean; deleted: Record<string, number> };
  if (out.has_orders) {
    const { error: e } = await admin.auth.admin.updateUserById(studentId, {
      email: `deleted-${studentId}@deleted.invalid`,
      user_metadata: { full_name: null, class_level: null, parent_phone: null, parent_email: null, parent_name: null, parent_whatsapp_opt_in: null, acquisition: null },
      ban_duration: BAN,
    });
    if (e) throw new Error(`could not disable login: ${e.message}`);
  } else {
    const { error: e } = await admin.auth.admin.deleteUser(studentId);
    if (e) throw new Error(`could not delete login: ${e.message}`);
  }
  return { mode: out.has_orders ? "anonymised" : "deleted", deleted: out.deleted, files };
}

/** Admin confirms a pending request → erase → mark completed (audited, no personal data in the log). */
export async function completeDeletion(requestId: string, actorId: string): Promise<EraseOutcome> {
  const admin = createAdminClient();
  const { data: req } = await admin.from("deletion_requests").select("id, subject_id, status").eq("id", requestId).maybeSingle();
  if (!req || req.status !== "pending") throw new Error("not pending");
  const outcome = await eraseStudent(req.subject_id);
  await admin
    .from("deletion_requests")
    .update({ status: "completed", completed_at: new Date().toISOString(), completed_by: actorId, outcome: outcome as unknown as Json })
    .eq("id", requestId);
  await writeAudit({ actorId, action: "privacy.erased", targetType: "deletion_request", targetId: requestId, metadata: { mode: outcome.mode } });
  return outcome;
}

export type CleanupResult = { purgedPending: number; expiredPaymentLinks: number; rateLimits: number };

/**
 * Daily housekeeping (data minimisation): accounts whose parent never approved
 * within PENDING_RETENTION_DAYS are erased; stale payment links and rate-limit rows go.
 */
export async function runCleanup(now = new Date()): Promise<CleanupResult> {
  const admin = createAdminClient();
  const cutoff = new Date(now.getTime() - PENDING_RETENTION_DAYS * 864e5).toISOString();
  const { data: stale } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .in("account_status", ["pending_consent", "pending_profile"])
    .lt("created_at", cutoff)
    .limit(200);
  let purgedPending = 0;
  for (const s of stale ?? []) {
    try {
      const outcome = await eraseStudent(s.id);
      await admin.from("deletion_requests").update({ status: "cancelled", cancelled_at: now.toISOString() }).eq("subject_id", s.id).eq("status", "pending");
      await admin.from("deletion_requests").insert({
        subject_id: s.id,
        source: "auto",
        note: `No parent approval within ${PENDING_RETENTION_DAYS} days`,
        status: "completed",
        completed_at: now.toISOString(),
        outcome: outcome as unknown as Json,
      });
      purgedPending++;
    } catch (e) {
      console.error("cleanup: erase failed", s.id, e);
    }
  }
  const { count: expiredPaymentLinks } = await admin
    .from("payment_requests")
    .delete({ count: "exact" })
    .neq("status", "paid")
    .lt("expires_at", cutoff);
  const { count: rateLimits } = await admin
    .from("rate_limits")
    .delete({ count: "exact" })
    .lt("window_start", new Date(now.getTime() - 2 * 864e5).toISOString());
  return { purgedPending, expiredPaymentLinks: expiredPaymentLinks ?? 0, rateLimits: rateLimits ?? 0 };
}

/** Everything we hold about a student, as JSON (DPDP right to access). */
export async function exportStudentData(studentId: string) {
  const admin = createAdminClient();
  const q = <T,>(p: PromiseLike<{ data: T | null }>) => Promise.resolve(p).then((r) => r.data ?? []);
  const [profile, consents, enrollments, progress, answers, submissions, minutes, external, events, orders, invoices, messages] = await Promise.all([
    admin
      .from("profiles")
      .select("email, full_name, class_level, locale, account_status, parent_name, parent_phone, parent_email, parent_whatsapp_opt_in, gallery_consent, created_at")
      .eq("id", studentId)
      .single()
      .then((r) => r.data),
    q(admin.from("consents").select("status, method, policy_version, granted_at, whatsapp_opt_in, gallery_consent, created_at").eq("student_id", studentId)),
    q(admin.from("enrollments").select("source, status, created_at, courses(title)").eq("user_id", studentId)),
    q(admin.from("lesson_progress").select("status, quiz_score, completed_at, lessons(title)").eq("user_id", studentId)),
    q(admin.from("block_responses").select("block_id, block_type, response, score, completed, updated_at").eq("user_id", studentId)),
    q(admin.from("external_submissions").select("kind, url, text_answer, status, feedback, share_in_gallery, created_at").eq("user_id", studentId)),
    q(admin.from("activity_minutes").select("date, seconds").eq("user_id", studentId).order("date")),
    q(admin.from("external_task_minutes").select("date, seconds").eq("user_id", studentId).order("date")),
    q(admin.from("learning_events").select("event_type, occurred_at, score").eq("user_id", studentId).order("occurred_at", { ascending: false }).limit(2000)),
    q(admin.from("orders").select("status, total_paise, payer_name, payer_phone, payer_email, created_at, courses(title)").eq("student_id", studentId)),
    q(admin.from("invoices").select("number, kind, total_paise, issued_at, buyer_name").eq("buyer_id", studentId)),
    q(admin.from("whatsapp_messages").select("template, body, status, created_at").eq("student_id", studentId)),
  ]);
  return {
    exported_at: new Date().toISOString(),
    note: "All personal data AI Learning Hub holds for this account. Invoices are kept for tax law even after deletion.",
    profile,
    consents,
    enrollments,
    lesson_progress: progress,
    activity_answers: answers,
    project_submissions: submissions,
    active_time_by_day: minutes,
    estimated_external_time_by_day: external,
    recent_events: events,
    orders,
    invoices,
    whatsapp_messages_to_parent: messages,
  };
}
