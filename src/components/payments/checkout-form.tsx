"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { beginCheckout, payWithMock, previewPrice } from "@/lib/payments/actions";
import type { CheckoutStart } from "@/lib/payments/service";
import { formatInr } from "@/lib/format";
import { t } from "@/i18n";

type Child = { id: string; name: string; enrolled: boolean };
type Gateway = Extract<CheckoutStart, { kind: "gateway" }>;
type RazorpayHandlerResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function CheckoutForm({ courseId, courseTitle, listPaise, students }: { courseId: string; courseTitle: string; listPaise: number; students: Child[] }) {
  const router = useRouter();
  const eligible = students.filter((c) => !c.enrolled);
  const [studentId, setStudentId] = useState(eligible[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [price, setPrice] = useState({ list: listPaise, discount: 0, total: listPaise, applied: null as string | null });
  const [error, setError] = useState<string>();
  const [mock, setMock] = useState<Gateway | null>(null);
  const [pending, start] = useTransition();

  async function verify(orderId: string, r: RazorpayHandlerResponse) {
    const res = await fetch("/api/payments/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: orderId, ...r }),
    });
    const json = (await res.json()) as { status?: string; error?: string };
    if (!res.ok) return setError(json.error ?? t("pay.verifyFailed"));
    router.push(`/parent/purchases?order=${orderId}${json.status === "pending" ? "&pending=1" : ""}`);
  }

  function applyCoupon() {
    start(async () => {
      setError(undefined);
      const q = await previewPrice(courseId, code);
      if (!q.ok) return setError(q.error);
      setPrice({ list: q.listPaise, discount: q.discountPaise, total: q.totalPaise, applied: q.couponCode });
    });
  }

  function pay() {
    start(async () => {
      setError(undefined);
      const r = await beginCheckout(courseId, studentId, price.applied ?? undefined);
      if (!r.ok) return setError(r.error);
      if (r.start.kind === "free") return router.push(`/parent/purchases?order=${r.start.orderId}`);
      const gw = r.start;
      if (gw.mode === "mock") return setMock(gw);
      if (!(await loadRazorpay()) || !window.Razorpay) return setError(t("pay.gatewayLoadFailed"));
      const rzp = new window.Razorpay({
        key: gw.keyId,
        amount: gw.amount,
        currency: "INR",
        order_id: gw.providerOrderId,
        name: "AI Learning Hub",
        description: gw.courseTitle,
        prefill: { email: gw.email, name: gw.name },
        theme: { color: "#4338ca" },
        handler: (resp: RazorpayHandlerResponse) => void verify(gw.orderId, resp),
      });
      rzp.on("payment.failed", () => setError(t("pay.failed")));
      rzp.open();
    });
  }

  if (eligible.length === 0) {
    return <p className="rounded-xl border-2 border-dashed p-4">{students.length ? t("pay.allEnrolled") : t("pay.noChildren")}</p>;
  }

  return (
    <div className="space-y-5">
      <label className="block space-y-2">
        <span className="font-medium">{t("pay.forChild")}</span>
        <select value={studentId} onChange={(e) => setStudentId(e.currentTarget.value)} className="h-12 w-full rounded-lg border-2 border-input bg-background px-3">
          {eligible.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-end gap-2">
        <label className="flex-1 space-y-2">
          <span className="font-medium">{t("pay.coupon")}</span>
          <Input value={code} onChange={(e) => setCode(e.currentTarget.value.toUpperCase())} maxLength={32} autoCapitalize="characters" />
        </label>
        <Button type="button" variant="outline" disabled={pending || !code.trim()} onClick={applyCoupon}>
          <TicketPercent aria-hidden /> {t("pay.apply")}
        </Button>
      </div>

      <dl className="space-y-1 rounded-xl bg-muted p-4" aria-live="polite">
        <div className="flex justify-between">
          <dt>{courseTitle}</dt>
          <dd>{formatInr(price.list)}</dd>
        </div>
        {price.discount > 0 && (
          <div className="flex justify-between text-success">
            <dt>{t("pay.discount", { code: price.applied ?? "" })}</dt>
            <dd>−{formatInr(price.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t pt-2 text-lg font-bold">
          <dt>{t("pay.total")}</dt>
          <dd data-testid="total">{formatInr(price.total)}</dd>
        </div>
      </dl>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 font-medium text-destructive">
          {error}
        </p>
      )}

      <Button type="button" size="lg" className="w-full" disabled={pending || !studentId} onClick={pay}>
        <CreditCard aria-hidden /> {price.total === 0 ? t("pay.getFree") : t("pay.payNow", { price: formatInr(price.total) })}
      </Button>
      <p className="text-sm text-muted-foreground">{t("pay.secure")}</p>

      {mock && <MockCheckout gw={mock} onClose={() => setMock(null)} onSuccess={(r) => verify(mock.orderId, r)} onFail={() => setError(t("pay.failed"))} />}
    </div>
  );
}

/** Stand-in for Razorpay Checkout when running without keys (localhost/tests). */
function MockCheckout({ gw, onClose, onSuccess, onFail }: { gw: Gateway; onClose: () => void; onSuccess: (r: RazorpayHandlerResponse) => void; onFail: () => void }) {
  const [pending, start] = useTransition();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="mock-h" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-6 shadow-xl">
        <p className="rounded-lg bg-warning/20 p-2 text-center text-sm font-bold">{t("pay.mockBanner")}</p>
        <h2 id="mock-h" className="text-xl font-bold">
          {t("pay.mockTitle")}
        </h2>
        <p>
          {gw.courseTitle} · <strong>{formatInr(gw.amount)}</strong>
        </p>
        <div className="grid gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await payWithMock(gw.orderId, "success");
                if (r.ok) onSuccess(r);
                onClose();
              })
            }
          >
            {t("pay.mockPay")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await payWithMock(gw.orderId, "failure");
                onFail();
                onClose();
              })
            }
          >
            {t("pay.mockFail")}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("pay.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
