"use client";

import { useActionState, useState, useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Submit } from "@/components/studio/fields";
import {
  adminCancelDeletion,
  adminCompleteDeletion,
  adminRequestDeletion,
  cancelMyDeletion,
  requestMyDeletion,
  type PrivacyState,
} from "@/lib/privacy/actions";

export function DownloadMyData() {
  return (
    <Button asChild variant="outline">
      <a href="/api/me/export" download>
        <Download aria-hidden /> Download my data
      </a>
    </Button>
  );
}

/** Keyed by the pending request's date on the page, so it remounts when the request changes. */
export function DeleteMyAccount({ pendingSince }: { pendingSince: string | null }) {
  const [state, action] = useActionState<PrivacyState, FormData>(requestMyDeletion, {});
  const [cancelled, setCancelled] = useState<PrivacyState>();
  const [pending, start] = useTransition();
  if (pendingSince) {
    return (
      <div className="space-y-3 rounded-xl border-2 border-warning/60 bg-warning/10 p-4" data-testid="deletion-pending">
        <p>
          <strong>Deletion requested</strong> on {new Date(pendingSince).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}. We&apos;ll check
          with your parent and delete your data within 30 days.
        </p>
        <Button type="button" variant="outline" disabled={pending} onClick={() => start(async () => setCancelled(await cancelMyDeletion()))}>
          Keep my account (cancel request)
        </Button>
        {cancelled?.error && <FormMessage state={cancelled} />}
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        This deletes your progress, answers, projects and your parent&apos;s contact details. Courses you bought will be lost. Invoices are kept
        because the law requires it.
      </p>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Why are you leaving? (optional)</span>
        <textarea name="reason" maxLength={500} rows={2} className="w-full rounded-lg border-2 bg-background p-2" />
      </label>
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" name="confirm" required className="mt-1 size-5" />
        <span>I understand my account and learning data will be deleted.</span>
      </label>
      <FormMessage state={state} />
      <Submit variant="outline">Request deletion</Submit>
    </form>
  );
}

export function AdminRequestDeletion({ studentId }: { studentId: string }) {
  const [note, setNote] = useState("");
  const [state, setState] = useState<PrivacyState>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Parent asked to delete this account — how?</span>
        <input
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          maxLength={500}
          placeholder="e.g. WhatsApp message, 5 Nov"
          className="h-11 w-full rounded-lg border-2 bg-background px-3"
        />
      </label>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => start(async () => setState(await adminRequestDeletion(studentId, note)))}>
        Add to deletion queue
      </Button>
      <FormMessage state={state} />
    </div>
  );
}

export function DeletionActions({ requestId, label }: { requestId: string; label: string }) {
  const [state, setState] = useState<PrivacyState>({});
  const [pending, start] = useTransition();
  if (state.ok) return <FormMessage state={state} />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Permanently delete ${label}'s data? This can't be undone.`)) return;
          start(async () => setState(await adminCompleteDeletion(requestId)));
        }}
      >
        {pending ? "Deleting…" : "Delete data now"}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => setState(await adminCancelDeletion(requestId)))}>
        Cancel request
      </Button>
      <FormMessage state={state} />
    </div>
  );
}
