"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function Prompt({ children }: { children: React.ReactNode }) {
  return <p className="text-lg font-semibold sm:text-xl">{children}</p>;
}

export function Feedback({ tone, children }: { tone: "good" | "try" | "info"; children: React.ReactNode }) {
  const Icon = tone === "good" ? CheckCircle2 : CircleAlert;
  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded-xl border-2 p-3",
        tone === "good" && "border-success/50 bg-success/10",
        tone === "try" && "border-warning/60 bg-warning/15",
        tone === "info" && "border-primary/40 bg-primary/10",
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {children}
    </p>
  );
}
