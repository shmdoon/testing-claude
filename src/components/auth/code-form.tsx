"use client";

import { useActionState } from "react";
import { verifyCode, type AuthFormState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError, FormError, SubmitButton } from "./form-bits";
import { t } from "@/i18n";

export function CodeForm({ email, next, onReset }: { email: string; next?: string; onReset: () => void }) {
  const [state, action] = useActionState<AuthFormState, FormData>(verifyCode, { step: "code", email, next });
  return (
    <form action={action} className="space-y-4" noValidate>
      <p role="status" className="rounded-lg bg-secondary p-3 text-secondary-foreground">
        {t("auth.codeSent", { email })}
      </p>
      <input type="hidden" name="email" value={email} />
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-2">
        <Label htmlFor="token">{t("auth.codeLabel")}</Label>
        <Input
          id="token"
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          className="text-center text-2xl tracking-[0.5em]"
          aria-invalid={Boolean(state.fieldErrors?.token)}
          aria-describedby={state.fieldErrors?.token ? "token-error" : undefined}
        />
        <FieldError id="token-error" code={state.fieldErrors?.token} />
      </div>
      <FormError code={state.error} />
      <SubmitButton>{t("auth.verifyCode")}</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">{t("auth.noCodeHint")}</p>
      <Button type="button" variant="link" className="w-full" onClick={onReset}>
        {t("auth.useDifferentEmail")}
      </Button>
    </form>
  );
}
