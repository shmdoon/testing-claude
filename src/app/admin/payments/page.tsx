import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefundButton } from "@/components/payments/refund-button";
import { listOrders, parsePaymentFilters } from "@/lib/payments/admin-queries";
import { paymentsMode } from "@/lib/payments/provider";
import { formatInr } from "@/lib/format";

export const metadata = { title: "Payments" };

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const sp = await searchParams;
  const f = parsePaymentFilters(sp);
  const orders = await listOrders(f);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  const paid = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.total_paise, 0);
  const mode = paymentsMode();
  const select = "h-11 rounded-lg border-2 border-input bg-background px-3";

  return (
    <div className="space-y-5">
      <PageHeader title="Payments" description={`Gateway: ${mode}${mode === "mock" ? " (test — no real money)" : ""}`} />
      {sp.done && (
        <p role="status" className="rounded-2xl border-2 border-success/50 bg-success/10 p-4 font-semibold">
          {sp.done === "refunded" ? "Refunded. Access revoked and credit note sent." : "Refund requested; it completes when Razorpay confirms."}
        </p>
      )}
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Status</span>
          <select name="status" defaultValue={f.status ?? ""} className={`${select} block`}>
            <option value="">All</option>
            {["paid", "failed", "refunded", "created", "cancelled"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">From</span>
          <input type="date" name="from" defaultValue={f.from} className={`${select} block`} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">To</span>
          <input type="date" name="to" defaultValue={f.to} className={`${select} block`} />
        </label>
        <Button type="submit">Filter</Button>
        <Button asChild variant="outline">
          <a href={`/api/admin/payments-csv${qs ? `?${qs}` : ""}`}>
            <Download aria-hidden /> CSV
          </a>
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        {orders.length} orders · paid in view: <strong>{formatInr(paid)}</strong>
      </p>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {["Date", "Course", "Buyer", "Student", "Total", "Status", "Payment", "Documents", ""].map((h) => (
                <th key={h} scope="col" className="p-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b last:border-0 align-top" data-testid="order-row">
                <td className="p-3 whitespace-nowrap">{new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                <td className="p-3">{o.courses?.title}</td>
                <td className="p-3">
                  {o.buyer?.full_name}
                  <br />
                  <span className="text-muted-foreground">{o.buyer?.email}</span>
                </td>
                <td className="p-3">{o.student?.full_name}</td>
                <td className="p-3 whitespace-nowrap">
                  {formatInr(o.total_paise)}
                  {o.coupons?.code && <span className="block text-xs text-muted-foreground">{o.coupons.code}</span>}
                </td>
                <td className="p-3">
                  <Badge variant={o.status === "paid" ? "success" : o.status === "refunded" ? "outline" : "warning"}>{o.status}</Badge>
                  {o.provider === "mock" && <Badge variant="accent" className="mt-1">test</Badge>}
                </td>
                <td className="p-3 font-mono text-xs break-all">{o.payments[0]?.provider_payment_id?.slice(0, 24)}</td>
                <td className="p-3">
                  {o.invoices.map((i) => (
                    <Link key={i.id} href={`/api/invoices/${i.id}`} className="block font-medium text-primary underline">
                      {i.number}
                    </Link>
                  ))}
                </td>
                <td className="p-3">{o.status === "paid" && o.provider !== "free" && <RefundButton orderId={o.id} label={o.courses?.title ?? "order"} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
