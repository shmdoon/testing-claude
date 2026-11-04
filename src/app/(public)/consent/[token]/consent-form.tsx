"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { approveFromLink, type ConsentState } from "@/lib/consent/actions";
import { FormMessage, Submit } from "@/components/studio/fields";

export function ConsentForm({ token, childFirstName }: { token: string; childFirstName: string }) {
  const [state, action] = useActionState<ConsentState, FormData>(approveFromLink.bind(null, token), {});
  if (state.ok) {
    return (
      <div role="status" className="space-y-2 rounded-2xl border-2 border-success/50 bg-success/10 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
        <p className="text-xl font-bold">Thank you — {childFirstName}&apos;s account is approved.</p>
        <p>{childFirstName} can start learning now. We&apos;ll send updates to this WhatsApp number if you chose to receive them.</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <label className="flex min-h-11 items-start gap-3 rounded-xl border-2 p-3">
        <input type="checkbox" name="approve" className="mt-1 size-5" required />
        <span>
          <strong>I am {childFirstName}&apos;s parent or legal guardian</strong> and I agree to them using AI Learning Hub and to the
          processing of the data described above.
        </span>
      </label>
      <label className="flex min-h-11 items-start gap-3 rounded-xl border-2 p-3">
        <input type="checkbox" name="whatsapp" defaultChecked className="mt-1 size-5" />
        <span>Send me WhatsApp updates: payment links and invoices, a weekly progress summary, and teacher feedback on projects.</span>
      </label>
      <label className="flex min-h-11 items-start gap-3 rounded-xl border-2 p-3">
        <input type="checkbox" name="gallery" className="mt-1 size-5" />
        <span>
          Optional: allow {childFirstName}&apos;s teacher-approved projects to appear in the members-only class gallery (first name only). You
          can change this any time by messaging us.
        </span>
      </label>
      <FormMessage state={state} />
      <Submit>Approve account</Submit>
    </form>
  );
}
