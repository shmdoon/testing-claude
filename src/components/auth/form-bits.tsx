"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { t, type MessageKey } from "@/i18n";

export function errorText(code?: string): string | undefined {
  if (!code) return undefined;
  const key = `auth.errors.${code}` as MessageKey;
  const text = t(key);
  return text === key ? t("auth.errors.generic") : text;
}

export function FieldError({ id, code }: { id: string; code?: string }) {
  if (!code) return null;
  return (
    <p id={id} className="text-sm font-medium text-destructive">
      {errorText(code)}
    </p>
  );
}

export function FormError({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
      {errorText(code)}
    </p>
  );
}

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className={className ?? "w-full"} disabled={pending} aria-busy={pending}>
      {pending ? t("common.loading") : children}
    </Button>
  );
}
