"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { requestLoginCode, type AuthFormState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeForm } from "./code-form";
import { FieldError, FormError, SubmitButton } from "./form-bits";
import { t } from "@/i18n";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;
  const [state, action] = useActionState<AuthFormState, FormData>(requestLoginCode, { step: "email", next });
  // "Use a different email" dismisses the current code step without a round-trip.
  const [dismissed, setDismissed] = useState<AuthFormState | null>(null);

  if (state.step === "code" && state.email && state !== dismissed) {
    return <CodeForm email={state.email} next={state.next} onReset={() => setDismissed(state)} />;
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-2">
        <Label htmlFor="email">{t("common.email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        <FieldError id="email-error" code={state.fieldErrors?.email} />
      </div>
      <FormError code={state.error ?? params.get("error") ?? undefined} />
      <SubmitButton>{t("auth.sendCode")}</SubmitButton>
    </form>
  );
}
