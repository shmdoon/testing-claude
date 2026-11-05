import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CheckoutForm } from "@/components/payments/checkout-form";
import { getPaymentRequest } from "@/lib/payments/service";
import { paymentsMode } from "@/lib/payments/provider";
import { t } from "@/i18n";

export const metadata: Metadata = { title: "Pay for a course", robots: { index: false, follow: false } };

/** Payment link sent to the parent on WhatsApp — no login needed. */
export default function PayLinkPage({ params, searchParams }: PageProps<"/pay/[token]">) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Suspense fallback={<p className="min-h-svh">{t("common.loading")}</p>}>
        <Pay params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Pay({ params, searchParams }: { params: PageProps<"/pay/[token]">["params"]; searchParams: PageProps<"/pay/[token]">["searchParams"] }) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const req = await getPaymentRequest(token);
  const child = (req?.profiles?.full_name ?? "your child").split(" ")[0]!;
  if (req?.status === "paid" || (req && sp.paid)) {
    return (
      <Card className="items-center text-center" role="status">
        <CheckCircle2 className="size-12 text-success" aria-hidden />
        <h1 className="text-xl font-bold">{sp.pending ? t("pay.pendingBanner") : t("pay.linkPaid", { child })}</h1>
      </Card>
    );
  }
  if (!req || req.expired || req.status !== "open" || !req.courses || req.courses.is_free) {
    return (
      <Card>
        <h1 className="text-2xl font-bold">{t("pay.linkExpiredTitle")}</h1>
        <p className="text-lg">{t("pay.linkExpired")}</p>
      </Card>
    );
  }
  const mode = paymentsMode();
  return (
    <Card className="gap-5">
      <h1 className="text-2xl font-bold">{t("pay.linkTitle", { child })}</h1>
      <p className="text-muted-foreground">{req.courses.title}</p>
      {mode === "disabled" ? (
        <p>{t("pay.disabled")}</p>
      ) : (
        <>
          {mode === "mock" && <p className="rounded-lg bg-warning/20 p-2 text-sm font-semibold">{t("pay.mockNotice")}</p>}
          <CheckoutForm
            courseId={req.course_id}
            courseTitle={req.courses.title}
            listPaise={req.courses.price_paise}
            payToken={token}
            successHref={`/pay/${token}`}
            defaults={{ payerName: req.profiles?.parent_name ?? "", payerEmail: req.profiles?.parent_email ?? "", payerPhone: req.profiles?.parent_phone ?? "" }}
          />
        </>
      )}
    </Card>
  );
}
