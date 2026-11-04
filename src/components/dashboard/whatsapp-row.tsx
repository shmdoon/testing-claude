"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markWhatsAppSent, runWeeklySummaryNow } from "@/lib/whatsapp/admin-actions";

export function ManualSend({ id, href }: { id: string; href: string }) {
  const [done, setDone] = useState<string>();
  const [pending, start] = useTransition();
  if (done) return <p role="status" className="text-sm font-medium text-success">{done}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm">
        <a href={href} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden /> Open in WhatsApp
        </a>
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => start(async () => void (await markWhatsAppSent(id, "manual_sent"), setDone("Marked as sent")))}>
        Mark as sent
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => void (await markWhatsAppSent(id, "cancelled"), setDone("Cancelled")))}>
        Cancel
      </Button>
    </div>
  );
}

export function RunWeekly() {
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runWeeklySummaryNow();
            setMsg(`${r.considered} children: ${r.sent} sent automatically, ${r.queued} queued below, ${r.skipped} already done this week.`);
          })
        }
      >
        Send weekly summaries now
      </Button>
      {msg && <span role="status" className="text-sm">{msg}</span>}
    </span>
  );
}
