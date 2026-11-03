import Link from "next/link";
import { Suspense } from "react";
import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  FileText,
  Hand,
  Hammer,
  Lightbulb,
  MessageCircleQuestion,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRoundCheck,
  BadgeCheck,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CourseCard } from "@/components/course-card";
import { BlockPreview } from "@/content/blocks/registry";
import { getCourseBySlug, getPublishedCourses } from "@/lib/content/catalog";
import { formatInr } from "@/lib/format";
import { FREE_COURSE_SLUG, stats, testimonials, type Campaign } from "@/content/marketing";
import { messages, t } from "@/i18n";
import { HeroVisual } from "./hero-visual";
import { LeadForm } from "./lead-form";
import { MarketingTags } from "./marketing-tags";

const steps = [
  { key: "activity", icon: Hand, color: "bg-phase-activity" },
  { key: "reflect", icon: MessageCircleQuestion, color: "bg-phase-reflection" },
  { key: "module", icon: Lightbulb, color: "bg-phase-module" },
  { key: "check", icon: BookOpenCheck, color: "bg-phase-check" },
] as const;

const whyIcons = [Hammer, Sparkles, Clock];
const parentIcons = [BarChart3, UserRoundCheck, BadgeCheck, FileText];

/** JSON for <script type="application/ld+json"> (escapes "<" to keep it inert). */
const ld = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

/**
 * Parent-facing marketing landing page. Used by "/" and every ad-campaign
 * variant at /lp/<key> (only the hero and CTAs change).
 */
export function LandingPage({ variant, interest }: { variant?: Campaign; interest?: string }) {
  const primaryHref = variant?.primaryTarget === "free-course" ? `/courses/${FREE_COURSE_SLUG}` : "#free-lesson";
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ld([
          {
            "@context": "https://schema.org",
            "@type": "EducationalOrganization",
            name: t("common.appName"),
            url: site,
            description: t("marketing.heroSubtitle"),
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: messages.marketing.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ])}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-14 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:pb-20">
          <div className="space-y-6">
            <p className="inline-flex rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
              {variant?.eyebrow ?? t("marketing.eyebrow")}
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">{variant?.headline ?? t("marketing.heroTitle")}</h1>
            <p className="max-w-xl text-lg text-muted-foreground sm:text-xl">{variant?.subheadline ?? t("marketing.heroSubtitle")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="accent">
                <Link href={primaryHref}>{variant?.ctaPrimary ?? t("marketing.ctaPrimary")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#pricing">{t("marketing.ctaSecondary")}</Link>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-2 text-sm font-medium" aria-label="Highlights">
              {[
                [Ban, t("marketing.trustNoAds")],
                [ShieldCheck, t("marketing.trustConsent")],
                [Smartphone, t("marketing.trustPhone")],
                [Clock, t("marketing.trustShort")],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Ban;
                return (
                  <li key={label as string} className="flex items-center gap-1.5">
                    <I className="size-4 text-success" aria-hidden /> {label as string}
                  </li>
                );
              })}
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      {stats.length > 0 && (
        <section className="border-y bg-muted/40">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 text-center sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-sm text-muted-foreground">{s.label}</dt>
                <dd className="text-3xl font-bold">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Why */}
      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="why-h">
        <h2 id="why-h" className="mb-8 max-w-2xl text-3xl font-bold sm:text-4xl">
          {t("marketing.whyTitle")}
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {messages.marketing.why.map((w, i) => {
            const Icon = whyIcons[i]!;
            return (
              <Card key={w.title}>
                <span className="grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground" aria-hidden>
                  <Icon className="size-6" />
                </span>
                <CardTitle>{w.title}</CardTitle>
                <CardDescription>{w.body}</CardDescription>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How */}
      <section id="how-it-works" className="scroll-mt-20 bg-muted/50 py-16" aria-labelledby="how-h">
        <div className="mx-auto max-w-6xl px-4">
          <p className="mb-2 font-semibold text-primary">{t("marketing.howEyebrow")}</p>
          <h2 id="how-h" className="mb-8 text-3xl font-bold sm:text-4xl">
            {t("landing.howTitle")}
          </h2>
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

      {/* Courses + live preview (cached catalogue data) */}
      <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse px-4 py-16" aria-hidden />}>
        <CourseSections />
      </Suspense>

      {/* For parents */}
      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="parents-h">
        <h2 id="parents-h" className="mb-8 text-3xl font-bold sm:text-4xl">
          {t("marketing.parentsTitle")}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {messages.marketing.parents.map((p, i) => {
            const Icon = parentIcons[i]!;
            return (
              <Card key={p.title} className="flex-row gap-4">
                <Icon className="size-8 shrink-0 text-primary" aria-hidden />
                <div className="space-y-1">
                  <CardTitle>{p.title}</CardTitle>
                  <CardDescription>{p.body}</CardDescription>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Safety */}
      <section className="bg-teal/10 py-16" aria-labelledby="safety-h">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[1fr_1.4fr] md:items-center">
          <div className="space-y-3">
            <ShieldCheck className="size-12 text-teal" aria-hidden />
            <h2 id="safety-h" className="text-3xl font-bold sm:text-4xl">
              {t("marketing.safetyTitle")}
            </h2>
          </div>
          <ul className="space-y-3">
            {messages.marketing.safety.map((s) => (
              <li key={s} className="flex gap-3 rounded-xl bg-card p-3 shadow-sm">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="t-h">
          <h2 id="t-h" className="mb-8 text-3xl font-bold">
            {t("marketing.testimonialsTitle")}
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {testimonials.map((q) => (
              <figure key={q.name} className="rounded-2xl border bg-card p-6">
                <blockquote className="text-lg">“{q.quote}”</blockquote>
                <figcaption className="mt-3 text-sm text-muted-foreground">
                  {q.name} · {q.detail}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16" aria-labelledby="faq-h">
        <h2 id="faq-h" className="mb-6 text-3xl font-bold">
          {t("marketing.faqTitle")}
        </h2>
        <div className="space-y-3">
          {messages.marketing.faq.map((item) => (
            <details key={item.q} className="group rounded-2xl border bg-card p-5 open:shadow-sm">
              <summary className="min-h-11 cursor-pointer list-none content-center font-semibold marker:hidden">{item.q}</summary>
              <p className="pt-2 text-muted-foreground">
                {item.a}
                {item.q.includes("refund") && (
                  <>
                    {" "}
                    <Link href="/legal/refund" className="font-semibold underline">
                      {t("legal.refund")}
                    </Link>
                  </>
                )}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Lead capture */}
      <section id="free-lesson" className="scroll-mt-20 bg-primary/5 py-16" aria-labelledby="lead-h">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 md:grid-cols-2 md:items-center">
          <div className="space-y-3">
            <h2 id="lead-h" className="text-3xl font-bold sm:text-4xl">
              {t("marketing.leadTitle")}
            </h2>
            <p className="text-lg text-muted-foreground">{t("marketing.leadBody")}</p>
          </div>
          <Card>
            <LeadForm interest={interest} />
          </Card>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-primary p-8 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">{t("marketing.finalTitle")}</h2>
            <p className="opacity-90">{t("marketing.finalBody")}</p>
          </div>
          <Button asChild variant="accent" size="lg">
            <Link href={`/courses/${FREE_COURSE_SLUG}`}>{t("marketing.ctaPrimary")}</Link>
          </Button>
        </div>
      </section>

      {/* Ad/analytics tags live ONLY on these parent-facing landing pages:
          consent-gated and never for signed-in users (students are never tracked). */}
      <MarketingTags />

      {/* Sticky mobile CTA */}
      <div className="h-20 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur md:hidden">
        <Button asChild size="lg" variant="accent" className="w-full">
          <Link href={primaryHref}>{variant?.ctaPrimary ?? t("marketing.stickyCta")}</Link>
        </Button>
      </div>
    </>
  );
}

async function CourseSections() {
  const [courses, free] = await Promise.all([getPublishedCourses(), getCourseBySlug(FREE_COURSE_SLUG)]);
  const paid = courses.filter((c) => !c.is_free);
  const cheapest = paid.length ? Math.min(...paid.map((c) => c.price_paise)) : null;
  const preview = free?.preview?.blocks[0];
  const ctx = { tools: Object.fromEntries((free?.tools ?? []).map((tool) => [tool.id, tool])) };
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <>
      {courses.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ld({
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: courses.map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              item: {
                "@type": "Course",
                name: c.title,
                description: c.subtitle ?? c.title,
                url: `${site}/courses/${c.slug}`,
                provider: { "@type": "Organization", name: t("common.appName") },
                offers: { "@type": "Offer", price: (c.price_paise / 100).toFixed(2), priceCurrency: "INR", category: c.is_free ? "Free" : "Paid" },
              },
            })),
          })}
        />
      )}

      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="learn-h">
        <h2 id="learn-h" className="text-3xl font-bold sm:text-4xl">
          {t("marketing.learnTitle")}
        </h2>
        <p className="mt-2 mb-8 text-muted-foreground">{t("marketing.learnSubtitle")}</p>
        {courses.length === 0 ? (
          <p className="text-muted-foreground">{t("landing.featuredEmpty")}</p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 3).map((c) => (
              <li key={c.id}>
                <CourseCard course={c} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {preview && (
        <section className="mx-auto max-w-6xl px-4 pb-16" aria-labelledby="preview-h">
          <div className="grid gap-8 rounded-3xl border-2 bg-card p-6 sm:p-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
            <div className="space-y-3">
              <h2 id="preview-h" className="text-3xl font-bold">
                {t("marketing.previewTitle")}
              </h2>
              <p className="text-muted-foreground">{t("marketing.previewBody")}</p>
              <Button asChild size="lg">
                <Link href={`/courses/${FREE_COURSE_SLUG}`}>{t("marketing.previewCta")}</Link>
              </Button>
            </div>
            <div className="rounded-2xl border-2 border-l-8 border-l-phase-activity bg-background p-5">
              <BlockPreview block={preview} ctx={ctx} />
            </div>
          </div>
        </section>
      )}

      <section id="pricing" className="scroll-mt-20 bg-muted/50 py-16" aria-labelledby="pricing-h">
        <div className="mx-auto max-w-6xl px-4">
          <h2 id="pricing-h" className="text-3xl font-bold sm:text-4xl">
            {t("marketing.pricingTitle")}
          </h2>
          <p className="mt-2 mb-8 text-muted-foreground">{t("marketing.pricingBody")}</p>
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardTitle>{t("marketing.pricingFree")}</CardTitle>
              <p className="text-4xl font-bold">{t("courses.free")}</p>
              <CardDescription>{t("marketing.pricingFreeBody")}</CardDescription>
              <Button asChild variant="accent">
                <Link href={`/courses/${FREE_COURSE_SLUG}`}>{t("marketing.ctaPrimary")}</Link>
              </Button>
            </Card>
            {cheapest !== null && (
              <Card className="border-primary/50">
                <CardTitle>{t("marketing.pricingFrom")}</CardTitle>
                <p className="text-4xl font-bold">{formatInr(cheapest)}</p>
                <CardDescription>{t("marketing.pricingFromBody")} {formatInr(cheapest)}.</CardDescription>
                <Button asChild variant="outline">
                  <Link href="/courses">{t("marketing.ctaSecondary")}</Link>
                </Button>
              </Card>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
