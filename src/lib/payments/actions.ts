"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { normalizePhone } from "@/lib/phone";
import { createPaymentLink, getPaymentRequest, mockPay, PaymentError, quote, startCheckout, type CheckoutStart, type OrderAuth } from "./service";

const uuid = z.uuid();
const coupon = z.string().trim().max(32).optional();
const payToken = z.string().regex(/^[A-Za-z0-9_-]{40,60}$/).optional();

/**
 * Who is checking out: the signed-in child account (in-app payment page) or
 * a parent holding a valid WhatsApp payment link (no login).
 */
async function resolve(courseId: string, token?: string): Promise<{ studentId: string; auth: OrderAuth; paymentRequestId?: string } | { error: string }> {
  if (token) {
    const req = await getPaymentRequest(token);
    if (!req || req.expired || req.status !== "open" || req.course_id !== courseId) return { error: "This payment link has expired or was already used." };
    return { studentId: req.student_id, auth: { paymentRequestId: req.id }, paymentRequestId: req.id };
  }
  const user = await getCurrentUser();
  if (!user || user.profile.role !== "student") return { error: "Sign in to the student's account to pay." };
  return { studentId: user.id, auth: { userId: user.id } };
}

export type QuoteResult = { ok: true; listPaise: number; discountPaise: number; totalPaise: number; couponCode: string | null } | { ok: false; error: string };

export async function previewPrice(courseId: string, couponCode?: string, token?: string): Promise<QuoteResult> {
  if (!uuid.safeParse(courseId).success || !coupon.safeParse(couponCode).success || !payToken.safeParse(token).success) return { ok: false, error: "Invalid request." };
  if (!(await rateLimit(`pay:quote:${await getClientIp()}`, 30, 60))) return { ok: false, error: "Too many attempts. Wait a minute." };
  const who = await resolve(courseId, token);
  if ("error" in who) return { ok: false, error: who.error };
  try {
    const q = await quote(createAdminClient(), courseId, who.studentId, couponCode || null);
    return { ok: true, listPaise: q.listPaise, discountPaise: q.discountPaise, totalPaise: q.totalPaise, couponCode: q.couponCode };
  } catch (e) {
    return { ok: false, error: e instanceof PaymentError ? e.message : "Something went wrong." };
  }
}

const payerSchema = z.object({
  name: z.string().trim().min(2, "Enter the payer's name (for the invoice).").max(120),
  email: z.union([z.literal(""), z.email("Enter a valid email or leave it empty.")]).optional(),
  phone: z.string().optional(),
  adult: z.literal(true, { message: "A parent or guardian (18+) must make the payment." }),
});

export async function beginCheckout(
  courseId: string,
  input: { couponCode?: string; payerName: string; payerEmail?: string; payerPhone?: string; adult: boolean },
  token?: string,
): Promise<{ ok: true; start: CheckoutStart } | { ok: false; error: string }> {
  if (!uuid.safeParse(courseId).success || !coupon.safeParse(input.couponCode).success || !payToken.safeParse(token).success) return { ok: false, error: "Invalid request." };
  const payer = payerSchema.safeParse({ name: input.payerName, email: input.payerEmail?.trim().toLowerCase(), phone: input.payerPhone, adult: input.adult });
  if (!payer.success) return { ok: false, error: payer.error.issues[0]!.message };
  const phone = input.payerPhone?.trim() ? normalizePhone(input.payerPhone) : null;
  if (input.payerPhone?.trim() && !phone) return { ok: false, error: "Enter a valid phone number or leave it empty." };
  if (!(await rateLimit(`pay:order:${await getClientIp()}`, 10, 300))) return { ok: false, error: "Too many attempts. Wait a few minutes." };
  const who = await resolve(courseId, token);
  if ("error" in who) return { ok: false, error: who.error };
  try {
    return {
      ok: true,
      start: await startCheckout({
        studentId: who.studentId,
        courseId,
        couponCode: input.couponCode || null,
        payer: { name: payer.data.name, email: payer.data.email || undefined, phone: phone ?? undefined },
        paymentRequestId: who.paymentRequestId,
      }),
    };
  } catch (e) {
    if (!(e instanceof PaymentError)) console.error("checkout failed", e);
    return { ok: false, error: e instanceof PaymentError ? e.message : "Couldn't start checkout." };
  }
}

/** Development/test only: plays the gateway for mock orders. */
export async function payWithMock(orderId: string, outcome: "success" | "failure", token?: string) {
  if (!uuid.safeParse(orderId).success || !payToken.safeParse(token).success) return { ok: false as const, error: "Invalid request." };
  let auth: OrderAuth;
  if (token) {
    const req = await getPaymentRequest(token);
    if (!req) return { ok: false as const, error: "Invalid link." };
    auth = { paymentRequestId: req.id };
  } else {
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, error: "Sign in again." };
    auth = { userId: user.id };
  }
  try {
    return await mockPay(auth, orderId, outcome);
  } catch (e) {
    return { ok: false as const, error: e instanceof PaymentError ? e.message : "Mock payment failed." };
  }
}

/** "Ask my parent to pay": WhatsApp payment link to the parent. */
export async function askParentToPay(courseId: string): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user || user.profile.role !== "student") return { ok: false, error: "Sign in first." };
  if (!uuid.safeParse(courseId).success) return { ok: false, error: "Invalid request." };
  if (!(await rateLimit(`pay:ask:${user.id}`, 3, 3600))) return { ok: false, error: "You can send up to 3 payment links an hour." };
  try {
    const r = await createPaymentLink(user.id, courseId);
    return { ok: true, status: r.status };
  } catch (e) {
    return { ok: false, error: e instanceof PaymentError ? e.message : "Couldn't send the link." };
  }
}
