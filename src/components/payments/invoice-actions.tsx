"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { regenerateInvoice } from "@/lib/payments/admin-actions";

export function InvoiceActions({ invoiceId }: { invoiceId: string }) {
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  const run = (email: boolean) =>
    start(async () => {
      const r = await regenerateInvoice(invoiceId, email);
      setMsg(r.message ?? r.error);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(false)}>
        Regenerate PDF
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(true)}>
        Resend to parent
      </Button>
      {msg && <span role="status" className="text-sm">{msg}</span>}
    </div>
  );
}
