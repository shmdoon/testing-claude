"use server";

import { z } from "zod";
import { requireArea } from "@/lib/auth/dal";
import { writeAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { approveConsent, getConsentByToken, requestConsent } from "./service";

export type ConsentState = { ok?: boolean; error?: string };

/** The parent approves from the WhatsApp link (no account needed). */
export async function approveFromLink(token: string, _prev: ConsentState, form: FormData): Promise<ConsentState> {
  if (!(await rateLimit(`consent:ip:${await getClientIp()}`, 20, 600))) return { error: "Too many attempts. Try again later." };
  if (form.get("approve") !== "on") return { error: "Please tick the box to approve the account." };
  const c = await getConsentByToken(token);
  if (!c || c.expired) return { error: "This link has expired. Ask your child to send a new one from their account." };
  if (c.granted) return { ok: true };
  await approveConsent(c.id, { whatsapp: form.get("whatsapp") === "on", gallery: form.get("gallery") === "on" }, "whatsapp_link");
  return { ok: true };
}

/** The child asks for the link to be sent again (rate-limited). */
export async function resendConsent(): Promise<ConsentState> {
  const user = await requireArea("learn");
  if (!(await rateLimit(`consent:resend:${user.id}`, 3, 3600))) return { error: "You can resend up to 3 times an hour." };
  const r = await requestConsent(user.id);
  return r.sent ? { ok: true } : { error: "Nothing to send." };
}

/** Admin approves (e.g. the parent confirmed on a call). Audited with a note. */
export async function adminApproveConsent(studentId: string, note: string): Promise<ConsentState> {
  const admin = await requireArea("admin");
  if (!z.uuid().safeParse(studentId).success) return { error: "Invalid." };
  const n = z.string().trim().min(5, "Add a short note (e.g. how the parent confirmed).").max(300).safeParse(note);
  if (!n.success) return { error: n.error.issues[0]!.message };
  const { data: c } = await createAdminClient().from("consents").select("id").eq("student_id", studentId).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!c) return { error: "No pending consent for this student." };
  await approveConsent(c.id, { whatsapp: true, gallery: false }, "admin");
  await writeAudit({ actorId: admin.id, action: "consent.granted_by_admin", targetType: "profile", targetId: studentId, metadata: { note: n.data } });
  return { ok: true };
}

/** Admin records a parent's change of mind about the gallery. */
export async function adminSetGallery(studentId: string, allow: boolean): Promise<ConsentState> {
  const admin = await requireArea("admin");
  if (!z.uuid().safeParse(studentId).success) return { error: "Invalid." };
  await createAdminClient().from("profiles").update({ gallery_consent: allow }).eq("id", studentId);
  await writeAudit({ actorId: admin.id, action: allow ? "gallery.consent_given" : "gallery.consent_withdrawn", targetType: "profile", targetId: studentId });
  return { ok: true };
}
