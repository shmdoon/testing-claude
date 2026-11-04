import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/area-shell";
import { Card } from "@/components/ui/card";
import { CheckoutForm } from "@/components/payments/checkout-form";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { paymentsMode } from "@/lib/payments/provider";
import { t } from "@/i18n";

export const metadata = { title: "Checkout" };

/** In-app payment page (the child's account; a parent completes the payment). */
export default async function CheckoutPage({ params }: PageProps<"/learn/checkout/[courseSlug]">) {
  const { courseSlug } = await params;
  const user = await requireArea("learn", `/learn/checkout/${courseSlug}`);
  const supabase = await createClient();
  const [{ data: course }, { data: me }] = await Promise.all([
    supabase.from("courses").select("id, title, is_free, price_paise").eq("slug", courseSlug).maybeSingle(),
    supabase.from("profiles").select("parent_name, parent_email, parent_phone, account_status").eq("id", user.id).single(),
  ]);
  if (!course || course.is_free) notFound();
  const mode = paymentsMode();
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title={t("pay.title")} description={course.title} />
      <Card>
        {mode === "disabled" ? (
          <p>{t("pay.disabled")}</p>
        ) : me?.account_status !== "active" ? (
          <p>{t("learn.pendingConsent")}</p>
        ) : (
          <>
            {mode === "mock" && <p className="rounded-lg bg-warning/20 p-2 text-sm font-semibold">{t("pay.mockNotice")}</p>}
            <CheckoutForm
              courseId={course.id}
              courseTitle={course.title}
              listPaise={course.price_paise}
              successHref={`/learn/${courseSlug}`}
              defaults={{ payerName: me?.parent_name ?? "", payerEmail: me?.parent_email ?? "", payerPhone: me?.parent_phone ?? "" }}
            />
          </>
        )}
      </Card>
    </div>
  );
}
