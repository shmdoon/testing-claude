import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { listOrders, parsePaymentFilters } from "@/lib/payments/admin-queries";
import { toCsv } from "@/lib/csv";
import { writeAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.profile.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
  const f = parsePaymentFilters(Object.fromEntries(request.nextUrl.searchParams));
  const rows = await listOrders(f, 10_000);
  await writeAudit({ actorId: user.id, action: "payments.exported", metadata: { rows: rows.length, ...f } });
  const csv = toCsv(
    ["order_id", "created_at", "status", "provider", "course", "buyer_name", "buyer_email", "student", "list_inr", "discount_inr", "total_inr", "coupon", "payment_id", "method", "refund_status", "invoice", "credit_note"],
    rows.map((o) => [
      o.id,
      o.created_at,
      o.status,
      o.provider,
      o.courses?.title,
      o.buyer?.full_name,
      o.buyer?.email,
      o.student?.full_name,
      (o.list_price_paise / 100).toFixed(2),
      (o.discount_paise / 100).toFixed(2),
      (o.total_paise / 100).toFixed(2),
      o.coupons?.code,
      o.payments[0]?.provider_payment_id,
      o.payments[0]?.method,
      o.refunds[0]?.status,
      o.invoices.find((i) => i.kind === "invoice")?.number,
      o.invoices.find((i) => i.kind === "credit_note")?.number,
    ]),
  );
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
