"use server";

import { z } from "zod";
import { requireArea } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/security/rate-limit";
import { mockPay, PaymentError, quote, startCheckout, type CheckoutStart } from "./service";

const uuid = z.uuid();
const coupon = z.string().trim().max(32).optional();

export type QuoteResult = { ok: true; listPaise: number; discountPaise: number; totalPaise: number; couponCode: string | null } | { ok: false; error: string };

export async function previewPrice(courseId: string, couponCode?: string): Promise<QuoteResult> {
  const user = await requireArea("parent");
  if (!uuid.safeParse(courseId).success || !coupon.safeParse(couponCode).success) return { ok: false, error: "Invalid request." };
  if (!(await rateLimit(`pay:quote:${user.id}`, 30, 60))) return { ok: false, error: "Too many attempts. Wait a minute." };
  try {
    const q = await quote(createAdminClient(), courseId, user.id, couponCode || null);
    return { ok: true, listPaise: q.listPaise, discountPaise: q.discountPaise, totalPaise: q.totalPaise, couponCode: q.couponCode };
  } catch (e) {
    return { ok: false, error: e instanceof PaymentError ? e.message : "Something went wrong." };
  }
}

export async function beginCheckout(courseId: string, studentId: string, couponCode?: string): Promise<{ ok: true; start: CheckoutStart } | { ok: false; error: string }> {
  const user = await requireArea("parent");
  if (!uuid.safeParse(courseId).success || !uuid.safeParse(studentId).success || !coupon.safeParse(couponCode).success) {
    return { ok: false, error: "Invalid request." };
  }
  if (!(await rateLimit(`pay:order:${user.id}`, 10, 300))) return { ok: false, error: "Too many attempts. Wait a few minutes." };
  try {
    return { ok: true, start: await startCheckout({ buyerId: user.id, studentId, courseId, couponCode: couponCode || null }) };
  } catch (e) {
    if (!(e instanceof PaymentError)) console.error("checkout failed", e);
    return { ok: false, error: e instanceof PaymentError ? e.message : "Couldn't start checkout." };
  }
}

/** Development/test only: plays the gateway for mock orders. */
export async function payWithMock(orderId: string, outcome: "success" | "failure") {
  const user = await requireArea("parent");
  if (!uuid.safeParse(orderId).success) return { ok: false as const, error: "Invalid request." };
  try {
    return await mockPay(user.id, orderId, outcome);
  } catch (e) {
    return { ok: false as const, error: e instanceof PaymentError ? e.message : "Mock payment failed." };
  }
}
