import { Award, Lock } from "lucide-react";
import type { Badge } from "@/lib/learn/badges";
import { cn } from "@/lib/utils";

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {badges.map((b) => (
        <li key={b.id} className={cn("flex gap-3 rounded-2xl border-2 p-4", b.earned ? "border-accent bg-accent/15" : "border-dashed bg-card")} data-earned={b.earned}>
          <span className={cn("grid size-12 shrink-0 place-items-center rounded-full", b.earned ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")} aria-hidden>
            {b.earned ? <Award className="size-6" /> : <Lock className="size-5" />}
          </span>
          <div className="min-w-0">
            <p className="font-bold">
              {b.title} <span className="sr-only">{b.earned ? "(earned)" : "(not yet)"}</span>
            </p>
            <p className="text-sm text-muted-foreground">{b.description}</p>
            {!b.earned && b.progress && b.progress.goal > 1 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {b.progress.value} / {b.progress.goal}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
