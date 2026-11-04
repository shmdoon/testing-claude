import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatInr } from "@/lib/format";
import { t } from "@/i18n";

export const metadata = { title: "Purchases" };

export default async function PurchasesPage() {
  const user = await requireArea("learn", "/learn/purchases");
  const { data: orders } = await (await createClient())
    .from("orders")
    .select("id, status, total_paise, created_at, payer_name, courses(title), invoices(id, number, kind)")
    .eq("buyer_id", user.id)
    .neq("status", "created")
    .order("created_at", { ascending: false });
  return (
    <div className="space-y-6">
      <PageHeader title={t("pay.purchases")} />
      {!orders?.length ? (
        <p className="rounded-2xl border-2 border-dashed p-6 text-center text-muted-foreground">{t("pay.noPurchases")}</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="space-y-2 rounded-2xl border bg-card p-4" data-testid="order">
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex-1 font-bold">{o.courses?.title}</p>
                <Badge variant={o.status === "paid" ? "success" : o.status === "refunded" ? "outline" : "warning"}>{t(`pay.status_${o.status}` as never)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatInr(o.total_paise)} · {new Date(o.created_at).toLocaleDateString("en-IN")} {o.payer_name && `· ${o.status === "paid" || o.status === "refunded" ? "paid by" : "attempted by"} ${o.payer_name}`}
              </p>
              <div className="flex flex-wrap gap-3">
                {o.invoices.map((inv) => (
                  <a key={inv.id} href={`/api/invoices/${inv.id}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline">
                    <Download className="size-4" aria-hidden />
                    {inv.kind === "credit_note" ? t("pay.creditNote") : t("pay.invoice")} {inv.number}
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
