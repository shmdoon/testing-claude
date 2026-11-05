import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import type { Database } from "../../src/lib/supabase/database.types";

export const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const RUN = Date.now().toString(36);

/** Creates a confirmed throwaway user with a role. No email is sent. */
export async function createUser(role: Database["public"]["Enums"]["app_role"], meta: Record<string, string> = {}) {
  const email = `e2e-${role}-${RUN}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${role}`, ...(role === "student" ? { parent_phone: "98765 43210", parent_whatsapp_opt_in: "true" } : {}), ...meta },
  });
  if (error) throw error;
  if (role === "content_editor" || role === "admin") {
    const { error: e } = await admin.from("profiles").update({ role, account_status: "active" }).eq("id", data.user.id);
    if (e) throw e;
  }
  return { id: data.user.id, email };
}

/** The newest WhatsApp message (outbox) for a student, optionally by template. */
export async function lastWhatsApp(studentId: string, template?: string) {
  let q = admin.from("whatsapp_messages").select("template, body, status, to_phone").eq("student_id", studentId).order("created_at", { ascending: false }).limit(1);
  if (template) q = q.eq("template", template);
  const { data } = await q;
  return data?.[0] ?? null;
}

/** First https link inside a WhatsApp message body. */
export function linkIn(body: string): string {
  const m = /https?:\/\/\S+/.exec(body);
  if (!m) throw new Error(`no link in: ${body}`);
  return m[0];
}

/** Signs the browser in via the magic-link route (token from the admin API). */
export async function signIn(page: Page, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`);
}

/**
 * Remove a throwaway user and everything tied to them. Orders/invoices block
 * profile deletion on purpose (tax records), so test (mock) money data is
 * removed first — real invoices can't be deleted and would make this fail loudly.
 */
export async function deleteUser(id: string) {
  const { data: orders } = await admin.from("orders").select("id").or(`buyer_id.eq.${id},student_id.eq.${id}`);
  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length) {
    const { data: invs } = await admin.from("invoices").select("id, pdf_path").in("order_id", orderIds);
    const paths = (invs ?? []).map((i) => i.pdf_path).filter(Boolean) as string[];
    if (paths.length) await admin.storage.from("invoices").remove(paths);
    await admin.from("invoices").delete().in("order_id", orderIds).eq("kind", "credit_note");
    await admin.from("invoices").delete().in("order_id", orderIds);
    await admin.from("enrollments").update({ order_id: null }).in("order_id", orderIds);
    await admin.from("refunds").delete().in("order_id", orderIds);
    await admin.from("payments").delete().in("order_id", orderIds);
    await admin.from("coupon_redemptions").delete().in("order_id", orderIds);
    await admin.from("orders").delete().in("id", orderIds);
  }
  const { data: user } = await admin.auth.admin.getUserById(id);
  if (user?.user?.email) await admin.from("email_log").delete().eq("to_email", user.user.email);
  const { data: files } = await admin.storage.from("submissions").list(id);
  if (files?.length) await admin.storage.from("submissions").remove(files.map((f) => `${id}/${f.name}`));
  await admin.from("audit_log").delete().eq("actor_id", id);
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error && !/not found/i.test(error.message)) throw new Error(`cleanup of ${id} failed: ${error.message}`);
  await admin.from("deletion_requests").delete().eq("subject_id", id);
}
