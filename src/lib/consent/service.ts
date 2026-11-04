import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, newToken, siteUrl } from "@/lib/links";
import { sendWhatsApp } from "@/lib/whatsapp/send";

const TTL_DAYS = 7;
const POLICY_VERSION = async () => {
  const { data } = await createAdminClient().from("settings").select("value").eq("key", "consent.policy_version").maybeSingle();
  return typeof data?.value === "string" ? data.value : "unversioned";
};

/**
 * (Re)send the parent a WhatsApp link to approve the child's account.
 * Called after the child verifies their email (never at raw signup, so a
 * stranger can't make us message an arbitrary number), or from "resend".
 */
export async function requestConsent(studentId: string, opts: { onlyIfNotSent?: boolean } = {}) {
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("consents")
    .select("id, status, parent_phone, token_expires_at, student_id, profiles!consents_student_id_fkey(full_name, account_status)")
    .eq("student_id", studentId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!c?.parent_phone || c.profiles?.account_status !== "pending_consent") return { sent: false as const, reason: "not_needed" };
  if (opts.onlyIfNotSent && c.token_expires_at && new Date(c.token_expires_at) > new Date()) return { sent: false as const, reason: "already_sent" };

  const token = newToken();
  await admin
    .from("consents")
    .update({ token_hash: await hashToken(token), token_expires_at: new Date(Date.now() + TTL_DAYS * 864e5).toISOString() })
    .eq("id", c.id);
  const first = (c.profiles?.full_name ?? "Your child").split(" ")[0]!;
  const r = await sendWhatsApp({
    to: c.parent_phone,
    template: "consent_request",
    params: [first, siteUrl(`/consent/${token}`)],
    studentId,
    related: { type: "consent", id: c.id },
  });
  return { sent: true as const, status: r.status };
}

export type ConsentView = { id: string; childName: string; classLevel: number | null; childEmail: string; expired: boolean; granted: boolean };

export async function getConsentByToken(token: string): Promise<ConsentView | null> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const { data } = await createAdminClient()
    .from("consents")
    .select("id, status, token_expires_at, profiles!consents_student_id_fkey(full_name, class_level, email)")
    .eq("token_hash", await hashToken(token))
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    childName: data.profiles?.full_name ?? "your child",
    classLevel: data.profiles?.class_level ?? null,
    childEmail: data.profiles?.email ?? "",
    expired: !data.token_expires_at || new Date(data.token_expires_at) < new Date(),
    granted: data.status === "granted",
  };
}

export async function approveConsent(consentId: string, choices: { whatsapp: boolean; gallery: boolean }, method: "whatsapp_link" | "admin") {
  const { error } = await createAdminClient().rpc("grant_consent", {
    p_consent_id: consentId,
    p_method: method,
    p_whatsapp_opt_in: choices.whatsapp,
    p_gallery: choices.gallery,
    p_policy_version: await POLICY_VERSION(),
  });
  if (error) throw error;
}
