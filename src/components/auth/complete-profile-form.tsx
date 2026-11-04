"use client";

import { useActionState } from "react";
import { completeProfile, type CompleteProfileState } from "@/lib/auth/actions";
import { StudentFields } from "./signup-form";
import { FormError, SubmitButton } from "./form-bits";
import { t } from "@/i18n";

export function CompleteProfileForm() {
  const [state, action] = useActionState<CompleteProfileState, FormData>(completeProfile, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      <StudentFields fieldErrors={state.fieldErrors ?? {}} values={state.values} />
      <FormError code={state.error} />
      <SubmitButton>{t("common.continue")}</SubmitButton>
    </form>
  );
}
