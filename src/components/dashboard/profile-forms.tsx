"use client";

import { useActionState, useState, useTransition } from "react";
import { setGalleryConsent, setMyGalleryShare, updateMyName, type SimpleState } from "@/lib/learn/profile-actions";
import { FormMessage, Submit, TextField } from "@/components/studio/fields";
import { fieldDefault } from "@/lib/forms";

export function NameForm({ name }: { name: string }) {
  const [state, action] = useActionState<SimpleState, FormData>(updateMyName, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
      <TextField name="full_name" label="Your name" defaultValue={fieldDefault(state.values, "full_name", name)} error={state.fieldErrors?.full_name} className="min-w-60 flex-1" />
      <Submit variant="secondary">Save</Submit>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function Toggle({ label, initial, onChange }: { label: string; initial: boolean; onChange: (v: boolean) => Promise<SimpleState> }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <label className="flex min-h-11 items-center gap-3">
      <input
        type="checkbox"
        role="switch"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const v = e.currentTarget.checked;
          setOn(v);
          start(async () => {
            const r = await onChange(v);
            if (r.error) {
              setOn(!v);
              setError(r.error);
            }
          });
        }}
        className="size-5"
      />
      <span>{label}</span>
      {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
    </label>
  );
}

export function GalleryShareToggle({ submissionId, initial }: { submissionId: string; initial: boolean }) {
  return <Toggle label="Show in the class gallery (first name only)" initial={initial} onChange={(v) => setMyGalleryShare(submissionId, v)} />;
}

export function GalleryConsentToggle({ studentId, initial, name }: { studentId: string; initial: boolean; name: string }) {
  return <Toggle label={`Allow ${name}'s approved projects in the members-only gallery (first name only)`} initial={initial} onChange={(v) => setGalleryConsent(studentId, v)} />;
}
