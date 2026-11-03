import { PageHeader } from "@/components/layout/area-shell";
import { Card } from "@/components/ui/card";
import { SettingsForm } from "@/components/payments/settings-form";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { paymentsMode } from "@/lib/payments/provider";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireArea("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("key, value");
  const values = Object.fromEntries((data ?? []).map((r) => [r.key, typeof r.value === "string" ? r.value : JSON.stringify(r.value)]));
  const mode = paymentsMode();
  const email = Boolean(process.env.RESEND_API_KEY);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Business and tax details for invoices. Changes apply to new invoices only." />
      <Card className="gap-2 text-sm">
        <p>
          <strong>Payment gateway:</strong> {mode === "razorpay" ? "Razorpay" : mode === "mock" ? "Mock (test mode — set Razorpay keys to go live)" : "Not configured"}
        </p>
        <p>
          <strong>Email:</strong> {email ? "Resend" : "Log only (set RESEND_API_KEY to send emails)"}
        </p>
      </Card>
      <Card>
        <SettingsForm values={values} />
      </Card>
    </div>
  );
}
