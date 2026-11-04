"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { askParentToPay } from "@/lib/payments/actions";
import { resendConsent } from "@/lib/consent/actions";
import { t } from "@/i18n";

export function AskParentToPay({ courseId }: { courseId: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending || msg?.ok}
        onClick={() =>
          start(async () => {
            const r = await askParentToPay(courseId);
            setMsg(r.ok ? { ok: true, text: r.status === "sent" ? t("pay.askParentSent") : t("pay.askParentQueued") } : { ok: false, text: r.error });
          })
        }
      >
        <MessageCircle aria-hidden /> {t("pay.askParent")}
      </Button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm font-medium text-success" : "text-sm font-medium text-destructive"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export function ResendConsent() {
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => start(async () => setMsg((await resendConsent()).error ?? t("learn.resent")))}>
        {t("learn.resendConsent")}
      </Button>
      {msg && <span role="status" className="text-sm">{msg}</span>}
    </span>
  );
}
