import { t } from "@/i18n";

/** Lightweight illustrated "phone" showing a lesson (pure markup — no image download). */
export function HeroVisual() {
  const steps = [
    { label: t("player.stepActivity"), cls: "bg-phase-activity" },
    { label: t("player.stepReflection"), cls: "bg-phase-reflection" },
    { label: t("player.stepModule"), cls: "bg-phase-module" },
    { label: t("player.stepCheck"), cls: "bg-phase-check" },
  ];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[300px] select-none">
      <div className="absolute -top-6 -right-6 size-32 rounded-full bg-accent/60 blur-2xl" />
      <div className="absolute -bottom-8 -left-8 size-36 rounded-full bg-teal/40 blur-2xl" />
      <div className="relative rounded-[2.2rem] border-[10px] border-foreground/90 bg-background p-4 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-foreground/20" />
        <div className="mb-3 grid grid-cols-4 gap-1">
          {steps.map((s, i) => (
            <div key={s.label} className="space-y-1 text-center">
              <div className={`h-1.5 rounded-full ${i === 0 ? s.cls : "bg-muted"}`} />
              <p className="text-[9px] font-semibold text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="mb-2 text-sm font-bold">Match each input with what AI learns</p>
        {[
          ["A photo of a leaf", "Plant disease"],
          ["A voice recording", "The words spoken"],
          ["An email", "Spam or not spam"],
        ].map(([l, r], i) => (
          <div key={l} className="mb-2 rounded-xl border-2 bg-card p-2 text-[11px]">
            <p className="font-medium">{l}</p>
            <p className={`mt-1 rounded-md border px-2 py-1 ${i < 2 ? "border-success/60 bg-success/10" : "text-muted-foreground"}`}>
              {i < 2 ? `✓ ${r}` : "Choose…"}
            </p>
          </div>
        ))}
        <div className="mt-3 rounded-xl bg-primary py-2 text-center text-xs font-semibold text-primary-foreground">Check my matches</div>
      </div>
    </div>
  );
}
