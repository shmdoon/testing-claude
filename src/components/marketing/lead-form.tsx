"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Submit, TextField } from "@/components/studio/fields";
import { submitLead, type LeadState } from "@/lib/marketing/actions";
import { trackConversion } from "@/lib/marketing/tags";
import { checkedDefault, fieldDefault } from "@/lib/forms";
import { FREE_COURSE_SLUG } from "@/content/marketing";
import { t } from "@/i18n";

export function LeadForm({ interest }: { interest?: string }) {
  const [state, action] = useActionState<LeadState, FormData>(submitLead, {});
  const tracked = useRef(false);
  useEffect(() => {
    if (state.ok && !tracked.current) {
      tracked.current = true;
      trackConversion("lead", { interest: interest ?? "home" });
    }
  }, [state.ok, interest]);

  if (state.ok) {
    return (
      <div role="status" className="space-y-4 rounded-2xl border-2 border-success/50 bg-success/10 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
        <p className="text-lg font-bold">{t("marketing.leadThanks")}</p>
        <Button asChild>
          <Link href={`/courses/${FREE_COURSE_SLUG}`}>{t("marketing.leadThanksCta")}</Link>
        </Button>
      </div>
    );
  }
  const fe = state.fieldErrors ?? {};
  const v = state.values;
  return (
    <form action={action} className="grid gap-4" noValidate aria-label={t("marketing.leadTitle")}>
      {interest && <input type="hidden" name="interest" value={interest} />}
      {/* Honeypot (hidden from people and assistive tech) */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <TextField name="email" type="email" autoComplete="email" label={t("marketing.leadEmail")} defaultValue={fieldDefault(v, "email")} error={fe.email} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" autoComplete="name" label={t("marketing.leadName")} defaultValue={fieldDefault(v, "name")} />
        <label className="space-y-2">
          <span className="font-medium">{t("marketing.leadClass")}</span>
          <select key={fieldDefault(v, "child_class")} name="child_class" defaultValue={fieldDefault(v, "child_class")} className="h-12 w-full rounded-lg border-2 border-input bg-background px-3">
            <option value="">{t("marketing.leadClassAny")}</option>
            {[6, 7, 8, 9].map((n) => (
              <option key={n} value={n}>
                {t("auth.classOption", { n })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" name="adult" defaultChecked={checkedDefault(v, "adult", false)} className="mt-1 size-5" aria-invalid={Boolean(fe.adult)} />
        <span>
          {t("marketing.leadAdult")}
          {fe.adult && <span className="block text-sm font-medium text-destructive">{t("marketing.leadAdultRequired")}</span>}
        </span>
      </label>
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" name="consent" defaultChecked={checkedDefault(v, "consent", false)} className="mt-1 size-5" />
        <span className="text-sm text-muted-foreground">{t("marketing.leadConsent")}</span>
      </label>
      <FormMessage state={{ error: state.error === "generic" ? t("marketing.leadError") : state.error }} />
      <Submit>{t("marketing.leadSubmit")}</Submit>
      <p className="text-xs text-muted-foreground">
        <Link href="/legal/privacy" className="underline">
          {t("legal.privacy")}
        </Link>
      </p>
    </form>
  );
}
