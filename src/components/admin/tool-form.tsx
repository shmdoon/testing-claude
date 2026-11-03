"use client";

import { useActionState } from "react";
import { saveTool } from "@/lib/content/tool-actions";
import type { ActionState } from "@/lib/content/studio-actions";
import { CheckboxField, FormMessage, Submit, TextField } from "@/components/studio/fields";
import { checkedDefault, fieldDefault } from "@/lib/forms";

export type ToolRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  base_url: string;
  logo_url: string | null;
  submission_domains: string[];
  min_age: number;
  requires_account: boolean;
  enabled: boolean;
};

export function ToolForm({ tool }: { tool?: ToolRow }) {
  const [state, action] = useActionState<ActionState, FormData>(saveTool.bind(null, tool?.id ?? null), {});
  const fe = state.fieldErrors ?? {};
  const v = state.values;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <TextField name="name" label="Name" defaultValue={fieldDefault(v, "name", tool?.name)} error={fe.name} />
      <TextField name="slug" label="Slug" defaultValue={fieldDefault(v, "slug", tool?.slug)} error={fe.slug} />
      <TextField name="base_url" label="Launch URL" defaultValue={fieldDefault(v, "base_url", tool?.base_url)} error={fe.base_url} placeholder="https://" />
      <TextField name="logo_url" label="Logo URL (optional)" defaultValue={fieldDefault(v, "logo_url", tool?.logo_url ?? "")} error={fe.logo_url} />
      <TextField
        name="submission_domains"
        label="Allowed submission domains"
        defaultValue={fieldDefault(v, "submission_domains", tool?.submission_domains.join(", "))}
        error={fe.submission_domains}
        help="For URL submissions, e.g. *.netlify.app. Leave empty if students don't submit links."
      />
      <TextField name="min_age" label="Minimum age" type="number" min={0} max={21} defaultValue={fieldDefault(v, "min_age", tool?.min_age ?? 13)} error={fe.min_age} />
      <TextField name="description" label="Description" defaultValue={fieldDefault(v, "description", tool?.description ?? "")} error={fe.description} className="sm:col-span-2" />
      <CheckboxField name="requires_account" label="Students need their own account" defaultChecked={checkedDefault(v, "requires_account", tool?.requires_account ?? true)} />
      <CheckboxField name="enabled" label="Enabled (disabled tools show the lesson's fallback)" defaultChecked={checkedDefault(v, "enabled", tool?.enabled ?? true)} />
      <div className="space-y-3 sm:col-span-2">
        <FormMessage state={state} />
        <Submit>{tool ? "Save tool" : "Add tool"}</Submit>
      </div>
    </form>
  );
}
