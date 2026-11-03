"use client";

import { useId } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/content/studio-actions";

export function TextField({
  name,
  label,
  error,
  help,
  multiline,
  className,
  ...rest
}: {
  name: string;
  label: string;
  error?: string;
  help?: string;
  multiline?: boolean;
} & React.ComponentProps<"input"> &
  Pick<React.ComponentProps<"textarea">, "rows">) {
  const id = useId();
  const describedBy = [help && `${id}-help`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <textarea
          id={id}
          name={name}
          rows={rest.rows ?? 4}
          defaultValue={rest.defaultValue as string | undefined}
          placeholder={rest.placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-invalid:border-destructive"
        />
      ) : (
        <Input id={id} name={name} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...rest} />
      )}
      {help && (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckboxField({ name, label, defaultChecked, value }: { name: string; label: string; defaultChecked?: boolean; value?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="size-5 accent-[var(--primary)]" />
      <span>{label}</span>
    </label>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="rounded-lg bg-success/10 p-3 text-sm font-medium text-success">
        {state.message}
      </p>
    );
  return null;
}

export function Submit({ children, variant }: { children: React.ReactNode; variant?: "default" | "outline" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
      {pending ? "Saving…" : children}
    </Button>
  );
}
