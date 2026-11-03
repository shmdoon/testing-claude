"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { refundOrder, type AdminState } from "@/lib/payments/admin-actions";

export function RefundButton({ orderId, label }: { orderId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<AdminState>({});
  const [pending, start] = useTransition();
  const router = useRouter();
  if (state.ok) return <p className="text-sm font-medium text-success" role="status">{state.message}</p>;
  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Refund
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border-2 border-destructive/40 p-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Reason for refunding {label}</span>
        <Input value={reason} onChange={(e) => setReason(e.currentTarget.value)} maxLength={500} />
      </label>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() =>
            start(async () => {
              const r = await refundOrder(orderId, reason);
              setState(r);
              // Show the outcome at page level: the row may leave a filtered list.
              if (r.ok) router.push(`/admin/payments?done=${r.message?.startsWith("Refunded") ? "refunded" : "requested"}`);
            })
          }>
          {pending ? "Refunding…" : "Confirm full refund"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {state.error && <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p>}
    </div>
  );
}
