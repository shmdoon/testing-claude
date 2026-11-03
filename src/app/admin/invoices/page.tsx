import Link from "next/link";
import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { InvoiceActions } from "@/components/payments/invoice-actions";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatInr } from "@/lib/format";

export const metadata = { title: "Invoices" };

export default async function AdminInvoicesPage() {
  await requireArea("admin");
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, number, kind, buyer_name, buyer_email, total_paise, issued_at, emailed_at, is_test")
    .order("issued_at", { ascending: false })
    .limit(300);
  return (
    <div className="space-y-5">
      <PageHeader title="Invoices" description="Invoices and credit notes are numbered per financial year without gaps and never change once issued." />
      <ul className="space-y-3">
        {(invoices ?? []).map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
            <div className="flex-1">
              <Link href={`/api/invoices/${i.id}`} className="font-bold text-primary underline">
                {i.number}
              </Link>{" "}
              {i.kind === "credit_note" && <Badge variant="outline">credit note</Badge>} {i.is_test && <Badge variant="accent">test</Badge>}
              <p className="text-sm text-muted-foreground">
                {i.buyer_name} · {i.buyer_email} · {formatInr(i.total_paise)} · {new Date(i.issued_at).toLocaleDateString("en-IN")} ·{" "}
                {i.emailed_at ? "emailed" : "not emailed"}
              </p>
            </div>
            <InvoiceActions invoiceId={i.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
