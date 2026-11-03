import Link from "next/link";
import { BookOpenCheck, Hand, Lightbulb, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { messages, t } from "@/i18n";

const steps = [
  { key: "activity", icon: Hand, color: "bg-phase-activity" },
  { key: "reflect", icon: MessageCircleQuestion, color: "bg-phase-reflection" },
  { key: "module", icon: Lightbulb, color: "bg-phase-module" },
  { key: "check", icon: BookOpenCheck, color: "bg-phase-check" },
] as const;

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:pt-20">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{t("landing.heroTitle")}</h1>
          <p className="text-lg text-muted-foreground sm:text-xl">{t("landing.heroSubtitle")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/courses">{t("landing.heroCta")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#how-it-works">{t("landing.heroSecondary")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 bg-muted/50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-8 text-3xl font-bold">{t("landing.howTitle")}</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ key, icon: Icon, color }, i) => (
              <li key={key}>
                <Card className="h-full">
                  <div className="flex items-center gap-3">
                    <span className={`grid size-11 place-items-center rounded-xl text-white ${color}`} aria-hidden>
                      <Icon className="size-6" />
                    </span>
                    <span className="text-sm font-semibold text-muted-foreground">{i + 1} / 4</span>
                  </div>
                  <CardTitle>{t(`landing.steps.${key}.title`)}</CardTitle>
                  <CardDescription>{t(`landing.steps.${key}.body`)}</CardDescription>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-4 text-3xl font-bold">{t("landing.featuredTitle")}</h2>
        <p className="text-muted-foreground">{t("landing.featuredEmpty")}</p>
      </section>

      <section id="pricing" className="scroll-mt-20 bg-muted/50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-4 text-3xl font-bold">{t("landing.pricingTitle")}</h2>
          <p className="max-w-2xl text-muted-foreground">{t("landing.pricingBody")}</p>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16">
        <h2 className="mb-6 text-3xl font-bold">{t("landing.faqTitle")}</h2>
        <div className="space-y-3">
          {messages.landing.faq.map((item) => (
            <details key={item.q} className="group rounded-2xl border bg-card p-5 open:shadow-sm">
              <summary className="min-h-11 cursor-pointer list-none font-semibold marker:hidden">{item.q}</summary>
              <p className="pt-2 text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-primary p-8 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold">{t("landing.ctaTitle")}</h2>
          <Button asChild variant="accent" size="lg">
            <Link href="/signup">{t("landing.ctaButton")}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
