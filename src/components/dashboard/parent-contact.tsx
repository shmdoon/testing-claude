"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminApproveConsent, adminSetGallery } from "@/lib/consent/actions";
import { Toggle } from "./profile-forms";

export function AdminConsent({ studentId }: { studentId: string }) {
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 rounded-xl border-2 border-warning/50 p-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Approve on the parent&apos;s behalf — how did they confirm?</span>
        <Input value={note} onChange={(e) => setNote(e.currentTarget.value)} placeholder="e.g. Parent confirmed on a phone call, 4 Nov" maxLength={300} />
      </label>
      <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => setMsg((await adminApproveConsent(studentId, note)).error ?? "Approved — the account is active."))}>
        Approve account
      </Button>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}

export function AdminGallery({ studentId, initial }: { studentId: string; initial: boolean }) {
  return <Toggle label="Parent allows gallery sharing" initial={initial} onChange={(v) => adminSetGallery(studentId, v)} />;
}
