import Link from "next/link";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <p className="text-6xl" aria-hidden>
        🧭
      </p>
      <h1 className="text-3xl font-bold">{t("notFound.title")}</h1>
      <p className="text-muted-foreground">{t("notFound.body")}</p>
      <Button asChild>
        <Link href="/courses">{t("landing.heroCta")}</Link>
      </Button>
    </main>
  );
}
