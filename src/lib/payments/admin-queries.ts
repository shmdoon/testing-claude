import "server-only";
import { z } from "zod";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const paymentFilterSchema = z.object({
  status: z.enum(["paid", "failed", "refunded", "created", "cancelled"]).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
});
export type PaymentFilters = z.infer<typeof paymentFilterSchema>;

export function parsePaymentFilters(sp: Record<string, string | string[] | undefined>): PaymentFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  return paymentFilterSchema.parse({ status: one(sp.status), from: one(sp.from), to: one(sp.to) });
}

/** Orders with buyer, student, course, payment, refund and invoices (admin RLS). */
export async function listOrders(f: PaymentFilters, limit = 500) {
  await requireArea("admin");
  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select(
      "id, status, provider, provider_order_id, list_price_paise, discount_paise, total_paise, created_at, paid_at, buyer:profiles!orders_buyer_id_fkey(full_name, email), student:profiles!orders_student_id_fkey(full_name), courses(title), coupons(code), payments(provider_payment_id, status, method), refunds(status, amount_paise, reason), invoices(id, number, kind)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (f.status) q = q.eq("status", f.status);
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00+05:30`);
  if (f.to) q = q.lte("created_at", `${f.to}T23:59:59+05:30`);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
