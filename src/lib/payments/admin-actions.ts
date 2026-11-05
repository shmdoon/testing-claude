"use server";

import { revalidatePath, updateTag } from "next/cache";
import { SETTINGS_TAG } from "@/lib/legal";
import { z } from "zod";
import { requireArea } from "@/lib/auth/dal";
import { writeAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { echoOnError, type FormValues } from "@/lib/forms";
import { rupeesToPaise } from "@/lib/validation/content";
import { deliverInvoice, PaymentError, requestRefund } from "./service";
import { SETTING_RULES } from "./settings-rules";

export type AdminState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string>; values?: FormValues };
const uuid = z.uuid();

export async function refundOrder(orderId: string, reason: string): Promise<AdminState> {
  const user = await requireArea("admin");
  if (!uuid.safeParse(orderId).success) return { error: "Invalid order." };
  const r = z.string().trim().min(3, "Give a short reason.").max(500).safeParse(reason);
  if (!r.success) return { error: r.error.issues[0]!.message };
  try {
    const res = await requestRefund({ orderId, adminId: user.id, reason: r.data });
    revalidatePath("/admin/payments");
    return { ok: true, message: res.status === "processed" ? "Refunded. Access revoked and credit note sent." : "Refund requested; it completes when Razorpay confirms." };
  } catch (e) {
    return { error: e instanceof PaymentError ? e.message : "Refund failed." };
  }
}

export async function regenerateInvoice(invoiceId: string, email: boolean): Promise<AdminState> {
  const user = await requireArea("admin");
  if (!uuid.safeParse(invoiceId).success) return { error: "Invalid invoice." };
  try {
    const r = await deliverInvoice(invoiceId, { notify: email });
    await writeAudit({ actorId: user.id, action: email ? "invoice.resent" : "invoice.regenerated", targetType: "invoice", targetId: invoiceId });
    revalidatePath("/admin/invoices");
    return { ok: true, message: email ? `PDF regenerated and sent (WhatsApp: ${r.whatsapp ?? "no number"}, email: ${r.emailed ? "sent" : "none"}).` : "PDF regenerated." };
  } catch (e) {
    return { error: e instanceof PaymentError ? e.message : "Couldn't regenerate the invoice." };
  }
}

// --- coupons -----------------------------------------------------------------
const couponSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, "3–32 letters, numbers, - or _"),
    kind: z.enum(["percent", "flat"]),
    value: z.string().trim(),
    course_id: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
    expires_at: z
      .string()
      .trim()
      .transform((v) => (v ? new Date(`${v}T23:59:59+05:30`).toISOString() : null)),
    usage_limit: z
      .string()
      .trim()
      .transform((v) => (v ? Number(v) : null))
      .pipe(z.number().int().positive().nullable()),
  })
  .transform((v, ctx) => {
    let value: number;
    if (v.kind === "percent") {
      value = Number(v.value);
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "Percent must be 1–100" });
        return z.NEVER;
      }
    } else {
      const p = rupeesToPaise.safeParse(v.value);
      if (!p.success || p.data < 100) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "Enter at least ₹1" });
        return z.NEVER;
      }
      value = p.data;
    }
    return { ...v, value };
  });

export async function createCoupon(_prev: AdminState, form: FormData): Promise<AdminState> {
  return echoOnError<AdminState>(form, async () => {
    const user = await requireArea("admin");
    const parsed = couponSchema.safeParse(Object.fromEntries(["code", "kind", "value", "course_id", "expires_at", "usage_limit"].map((k) => [k, String(form.get(k) ?? "")])));
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
      return { fieldErrors };
    }
    const { error, data } = await createAdminClient().from("coupons").insert({ ...parsed.data, created_by: user.id }).select("id").single();
    if (error) return error.code === "23505" ? { fieldErrors: { code: "That code already exists." } } : { error: "Couldn't create the coupon." };
    await writeAudit({ actorId: user.id, action: "coupon.created", targetType: "coupon", targetId: data.id, metadata: { code: parsed.data.code, kind: parsed.data.kind, value: parsed.data.value } });
    revalidatePath("/admin/coupons");
    return { ok: true, message: `Coupon ${parsed.data.code} created.` };
  });
}

export async function setCouponActive(couponId: string, active: boolean): Promise<AdminState> {
  const user = await requireArea("admin");
  if (!uuid.safeParse(couponId).success) return { error: "Invalid coupon." };
  await createAdminClient().from("coupons").update({ active }).eq("id", couponId);
  await writeAudit({ actorId: user.id, action: active ? "coupon.activated" : "coupon.deactivated", targetType: "coupon", targetId: couponId });
  revalidatePath("/admin/coupons");
  return { ok: true };
}

// --- settings ----------------------------------------------------------------


export async function saveSettings(_prev: AdminState, form: FormData): Promise<AdminState> {
  return echoOnError<AdminState>(form, async () => {
    const user = await requireArea("admin");
    const fieldErrors: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    for (const [key, rule] of Object.entries(SETTING_RULES)) {
      const r = (rule as z.ZodType).safeParse(form.get(key) ?? "");
      if (r.success) values[key] = r.data;
      else fieldErrors[key] = r.error.issues[0]!.message;
    }
    if (values["tax.mode"] !== "none" && !values["business.gstin"]) fieldErrors["tax.mode"] = "Add a GSTIN before charging GST.";
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    // Through RLS as the admin (settings: admins update, updated_by = self).
    const supabase = await createClient();
    const { data: before } = await supabase.from("settings").select("key, value");
    const changed: string[] = [];
    for (const [key, value] of Object.entries(values)) {
      const old = before?.find((b) => b.key === key)?.value;
      if (JSON.stringify(old) === JSON.stringify(value)) continue;
      const { error } = await supabase.from("settings").update({ value: value as never, updated_by: user.id }).eq("key", key);
      if (error) return { error: `Couldn't save ${key}.` };
      changed.push(key);
    }
    if (changed.length) await writeAudit({ actorId: user.id, action: "settings.updated", targetType: "settings", metadata: { keys: changed } });
    revalidatePath("/admin/settings");
    if (changed.length) updateTag(SETTINGS_TAG); // legal pages
    return { ok: true, message: changed.length ? `Saved (${changed.length} changed). New invoices use these values; issued invoices never change.` : "No changes." };
  });
}
