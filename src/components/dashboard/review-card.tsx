"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hideFromGallery, reviewSubmission, type ReviewState } from "@/lib/review/actions";

export function ReviewActions({ id, status, shared }: { id: string; status: string; shared: boolean }) {
  const [feedback, setFeedback] = useState("");
  const [state, setState] = useState<ReviewState>({});
  const [pending, start] = useTransition();
  if (state.ok) {
    return (
      <p role="status" className="rounded-lg bg-success/10 p-3 text-sm font-semibold text-success">
        ✓ {state.message}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {status === "submitted" && (
        <>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Feedback for the student</span>
            <textarea value={feedback} onChange={(e) => setFeedback(e.currentTarget.value)} rows={2} maxLength={2000} className="w-full rounded-lg border-2 border-input bg-background p-2" />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => setState(await reviewSubmission(id, "approved", feedback)))}>
              <Check aria-hidden /> Approve
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => start(async () => setState(await reviewSubmission(id, "needs_revision", feedback)))}>
              <RotateCcw aria-hidden /> Needs revision
            </Button>
          </div>
        </>
      )}
      {status === "approved" && shared && (
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => setState(await hideFromGallery(id)))}>
          Remove from gallery
        </Button>
      )}
      {state.error && <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p>}
    </div>
  );
}
