import Link from "next/link";
import { t } from "@/i18n";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {t("footer.tagline")} {t("footer.noAds")}
        </p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link className="py-2 hover:text-foreground" href="/legal/privacy">
            {t("legal.privacy")}
          </Link>
          <Link className="py-2 hover:text-foreground" href="/legal/terms">
            {t("legal.terms")}
          </Link>
          <Link className="py-2 hover:text-foreground" href="/legal/refund">
            {t("legal.refund")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
