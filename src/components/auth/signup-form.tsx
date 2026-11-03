"use client";

import { useActionState, useState } from "react";
import { requestSignupCode, type AuthFormState } from "@/lib/auth/actions";
import { CLASS_LEVELS } from "@/lib/class-levels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeForm } from "./code-form";
import { FieldError, FormError, SubmitButton } from "./form-bits";
import { t } from "@/i18n";

type Role = "student" | "parent";

export function SignupForm() {
  const [state, action] = useActionState<AuthFormState, FormData>(requestSignupCode, { step: "email" });
  const [role, setRole] = useState<Role>("student");
  const [dismissed, setDismissed] = useState<AuthFormState | null>(null);

  if (state.step === "code" && state.email && state !== dismissed) {
    return <CodeForm email={state.email} onReset={() => setDismissed(state)} />;
  }
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <RolePicker role={role} onChange={setRole} />
      {role === "student" ? <StudentFields fieldErrors={fe} values={state.values} /> : <NameField fieldErrors={fe} values={state.values} />}
      <Field name="email" type="email" label={t("common.email")} autoComplete="email" error={fe.email} defaultValue={state.values?.email} />
      <FormError code={state.error} />
      <SubmitButton>{t("auth.createAccount")}</SubmitButton>
    </form>
  );
}

export function RolePicker({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-medium">{t("auth.iAmA")}</legend>
      <div className="grid grid-cols-2 gap-3">
        {(["student", "parent"] as const).map((r) => (
          <label
            key={r}
            className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border-2 px-3 text-center font-semibold has-checked:border-primary has-checked:bg-secondary has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name="role"
              value={r}
              checked={role === r}
              onChange={() => onChange(r)}
              className="sr-only"
            />
            {r === "student" ? t("auth.roleStudent") : t("auth.roleParent")}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type Echo = { fieldErrors: Record<string, string>; values?: Record<string, string> };

export function NameField({ fieldErrors, values }: Echo) {
  return <Field name="full_name" label={t("auth.fullName")} autoComplete="name" error={fieldErrors.full_name} defaultValue={values?.full_name} />;
}

export function StudentFields({ fieldErrors, values }: Echo) {
  return (
    <>
      <NameField fieldErrors={fieldErrors} values={values} />
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
      </div>
      <Field
        name="parent_email"
        type="email"
        label={t("auth.parentEmail")}
        help={t("auth.parentEmailHelp")}
        error={fieldErrors.parent_email}
        defaultValue={values?.parent_email}
      />
    </>
  );
}

function Field({
  name,
  label,
  help,
  error,
  ...rest
}: { name: string; label: string; help?: string; error?: string } & React.ComponentProps<"input">) {
  const describedBy = [help && `${name}-help`, error && `${name}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required aria-invalid={Boolean(error)} aria-describedby={describedBy} {...rest} />
      {help && (
        <p id={`${name}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
      <FieldError id={`${name}-error`} code={error} />
    </div>
  );
}
