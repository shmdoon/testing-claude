"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createCoupon, setCouponActive, type AdminState } from "@/lib/payments/admin-actions";
import { FormMessage, Submit, TextField } from "@/components/studio/fields";
import { fieldDefault } from "@/lib/forms";

export function CouponForm({ courses }: { courses: { id: string; title: string }[] }) {
  const [state, action] = useActionState<AdminState, FormData>(createCoupon, {});
  const fe = state.fieldErrors ?? {};
  const v = state.ok ? undefined : state.values;
  const select = "h-12 w-full rounded-lg border-2 border-input bg-background px-3";
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3" noValidate>
      <TextField name="code" label="Code" defaultValue={fieldDefault(v, "code")} error={fe.code} placeholder="WELCOME10" />
      <label className="space-y-2">
        <span className="font-medium">Type</span>
        <select key={fieldDefault(v, "kind", "percent")} name="kind" defaultValue={fieldDefault(v, "kind", "percent")} className={select}>
          <option value="percent">Percent off</option>
          <option value="flat">Flat ₹ off</option>
        </select>
      </label>
      <TextField name="value" label="Value (% or ₹)" defaultValue={fieldDefault(v, "value")} error={fe.value} inputMode="decimal" />
      <label className="space-y-2">
        <span className="font-medium">Course</span>
        <select key={fieldDefault(v, "course_id")} name="course_id" defaultValue={fieldDefault(v, "course_id")} className={select}>
          <option value="">Any paid course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <TextField name="expires_at" label="Expires (last valid day)" type="date" defaultValue={fieldDefault(v, "expires_at")} error={fe.expires_at} />
      <TextField name="usage_limit" label="Usage limit (optional)" type="number" min={1} defaultValue={fieldDefault(v, "usage_limit")} error={fe.usage_limit} />
      <div className="space-y-3 sm:col-span-3">
        <FormMessage state={state} />
        <Submit>Create coupon</Submit>
      </div>
    </form>
  );
}

export function CouponToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => start(async () => void (await setCouponActive(id, !active)))}>
      {active ? "Deactivate" : "Activate"}
    </Button>
  );
}
