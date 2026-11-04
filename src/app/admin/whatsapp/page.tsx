import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ManualSend, RunWeekly } from "@/components/dashboard/whatsapp-row";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { waLink } from "@/lib/phone";
import { whatsappMode } from "@/lib/whatsapp/send";

export const metadata = { title: "WhatsApp" };

const LABEL: Record<string, string> = {
  consent_request: "Approval request",
  payment_link: "Payment link",
  invoice_ready: "Invoice",
  refund_processed: "Refund",
  weekly_summary: "Weekly summary",
  project_feedback: "Teacher feedback",
};

export default async function WhatsAppPage({ searchParams }: PageProps<"/admin/whatsapp">) {
  await requireArea("admin", "/admin/whatsapp");
  const sp = await searchParams;
  const view = sp.view === "all" ? "all" : "todo";
  let q = (await createClient())
    .from("whatsapp_messages")
    .select("id, to_phone, template, body, status, error, created_at, sent_at, profiles!whatsapp_messages_student_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (view === "todo") q = q.in("status", ["manual", "failed"]);
  const { data: msgs } = await q;
  const mode = whatsappMode();
  return (
    <div className="space-y-5">
      <PageHeader title="WhatsApp" description="Messages to parents. Without API keys (or if the API fails) they wait here for one-tap sending." />
      <Card className="gap-2 text-sm">
        <p>
          <strong>Sending mode:</strong> {mode === "api" ? "WhatsApp Cloud API (automatic), with this list as fallback" : "Manual — set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID to send automatically"}
        </p>
        <RunWeekly />
      </Card>
      <div className="flex gap-2">
        <Button asChild size="sm" variant={view === "todo" ? "secondary" : "outline"}>
          <a href="/admin/whatsapp">To send</a>
        </Button>
        <Button asChild size="sm" variant={view === "all" ? "secondary" : "outline"}>
          <a href="/admin/whatsapp?view=all">All messages</a>
        </Button>
      </div>
      {!msgs?.length ? (
        <p className="rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground">Nothing to send.</p>
      ) : (
        <ul className="space-y-3">
          {msgs.map((m) => (
            <li key={m.id} className="space-y-2 rounded-2xl border bg-card p-4" data-testid="wa-row">
              <p className="flex flex-wrap items-center gap-2">
                <strong>{LABEL[m.template] ?? m.template}</strong>
                <Badge variant={m.status === "sent" || m.status === "manual_sent" ? "success" : m.status === "failed" ? "warning" : m.status === "cancelled" ? "outline" : "accent"}>
                  {m.status.replace("_", " ")}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  to {m.to_phone} · {m.profiles?.full_name ?? "—"} · {new Date(m.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                </span>
              </p>
              <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{m.body}</p>
              {m.error && <p className="text-xs text-destructive">API error: {m.error}</p>}
              {(m.status === "manual" || m.status === "failed") && <ManualSend id={m.id} href={waLink(m.to_phone, m.body)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
