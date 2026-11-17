import type { Metadata } from "next";
import { DemoPlayer } from "@/components/player/robot-sim/demo-player";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: t("playground.title"),
  description: t("playground.intro"),
  alternates: { canonical: "/playground" },
};

export default function PlaygroundPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <header className="space-y-3">
        <p className="inline-flex rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">{t("playground.eyebrow")}</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("playground.heading")}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{t("playground.intro")}</p>
      </header>
      <DemoPlayer />
    </div>
  );
}
