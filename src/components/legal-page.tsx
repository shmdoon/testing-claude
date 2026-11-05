import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { fillLegal, placeholderGaps, type LegalDoc } from "@/content/legal";
import { getLegalInfo } from "@/lib/legal";

const OTHERS = [
  { slug: "privacy", label: "Privacy policy" },
  { slug: "terms", label: "Terms of use" },
  { slug: "refund", label: "Refund policy" },
] as const;

export async function LegalPage({ doc }: { doc: LegalDoc }) {
  const { vars, reviewed } = await getLegalInfo();
  const gaps = placeholderGaps(vars);
  const f = (s: string) => fillLegal(s, vars);
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold">{doc.title}</h1>
        <p className="text-muted-foreground">
          {vars.platform_name} · Last updated {vars.last_updated}
        </p>
        {(!reviewed || gaps.length > 0) && (
          <p className="rounded-2xl border-2 border-warning/60 bg-warning/15 p-4 text-sm" data-testid="legal-draft">
            <strong>Draft.</strong> This text is being reviewed by our legal advisers and may change.
          </p>
        )}
      </header>
      <section aria-labelledby="summary-h" className="rounded-2xl border-2 bg-card p-5">
        <h2 id="summary-h" className="mb-2 text-xl font-bold">
          In short
        </h2>
        <ul className="ml-6 list-disc space-y-1">
          {doc.summary.map((s) => (
            <li key={s}>{f(s)}</li>
          ))}
        </ul>
      </section>
      <nav aria-label="Sections" className="text-sm">
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {doc.sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-block py-1 text-primary underline">
                {s.heading}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {doc.sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-20 space-y-3">
          <h2 id={`${s.id}-h`} className="text-2xl font-bold">
            {s.heading}
          </h2>
          <Markdown>
            {f(s.body)}
          </Markdown>
        </section>
      ))}
      <footer className="border-t pt-6 text-sm">
        <p className="flex flex-wrap gap-4">
          {OTHERS.filter((o) => o.slug !== doc.slug).map((o) => (
            <Link key={o.slug} href={`/legal/${o.slug}`} className="text-primary underline">
              {o.label}
            </Link>
          ))}
        </p>
      </footer>
    </article>
  );
}
