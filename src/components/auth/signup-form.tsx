"use client";

import { useActionState, useState } from "react";
import { requestSignupCode, type AuthFormState } from "@/lib/auth/actions";
import { CLASS_LEVELS } from "@/lib/class-levels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeForm } from "./code-form";
import { FieldError, FormError, SubmitButton } from "./form-bits";
import { t } from "@/i18n";

/** One account per child — created by the child or a parent. */
export function SignupForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(requestSignupCode, { step: "email" });
  const [dismissed, setDismissed] = useState<AuthFormState | null>(null);

  if (state.step === "code" && state.email && state !== dismissed) {
    return <CodeForm email={state.email} onReset={() => setDismissed(state)} />;
  }
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <StudentFields fieldErrors={fe} values={state.values} />
      <Field name="email" type="email" label={t("auth.studentEmail")} help={t("auth.studentEmailHelp")} autoComplete="email" error={fe.email} defaultValue={state.values?.email} />
      <FormError code={state.error} />
      <SubmitButton>{t("auth.createAccount")}</SubmitButton>
    </form>
  );
}

type Echo = { fieldErrors: Record<string, string>; values?: Record<string, string> };

export function StudentFields({ fieldErrors, values }: Echo) {
  return (
    <>
      <Field name="full_name" label={t("auth.childName")} autoComplete="off" error={fieldErrors.full_name} defaultValue={values?.full_name} />
      <div className="space-y-2">
        <Label htmlFor="class_level">{t("auth.classLevel")}</Label>
        <select
          id="class_level"
          key={values?.class_level ?? ""}
          name="class_level"
          required
          defaultValue={values?.class_level ?? ""}
          className="h-12 w-full rounded-lg border-2 border-input bg-background px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          aria-invalid={Boolean(fieldErrors.class_level)}
        >
          <option value="" disabled>
            —
          </option>
          {CLASS_LEVELS.map((n) => (
            <option key={n} value={n}>
              {t("auth.classOption", { n })}
            </option>
          ))}
        </select>
        <FieldError id="class_level-error" code={fieldErrors.class_level} />
      </div>
      <fieldset className="space-y-4 rounded-2xl border-2 p-4">
        <legend className="px-1 font-semibold">{t("auth.parentSection")}</legend>
        <Field
          name="parent_phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          label={t("auth.parentPhone")}
          help={t("auth.parentPhoneHelp")}
          placeholder="98765 43210"
          error={fieldErrors.parent_phone}
          defaultValue={values?.parent_phone}
        />
        <Field name="parent_name" label={t("auth.parentName")} autoComplete="off" required={false} error={fieldErrors.parent_name} defaultValue={values?.parent_name} />
        <Field name="parent_email" type="email" label={t("auth.parentEmailOptional")} required={false} autoComplete="off" error={fieldErrors.parent_email} defaultValue={values?.parent_email} />
        <label className="flex min-h-11 items-start gap-3">
          <input type="checkbox" name="whatsapp_opt_in" defaultChecked={values ? values.whatsapp_opt_in === "on" : false} className="mt-1 size-5" aria-invalid={Boolean(fieldErrors.whatsapp_opt_in)} />
          <span>
            {t("auth.whatsappOptIn")}
            <FieldError id="whatsapp_opt_in-error" code={fieldErrors.whatsapp_opt_in} />
          </span>
        </label>
      </fieldset>
    </>
  );
}

function Field({
  name,
  label,
  help,
  error,
  required = true,
  ...rest
}: { name: string; label: string; help?: string; error?: string; required?: boolean } & React.ComponentProps<"input">) {
  const describedBy = [help && `${name}-help`, error && `${name}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required={required} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...rest} />
      {help && (
        <p id={`${name}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
      <FieldError id={`${name}-error`} code={error} />
    </div>
  );
}
