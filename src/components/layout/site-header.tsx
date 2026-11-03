import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "./logo";
import { UserMenu, UserMenuFallback } from "./user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { t } from "@/i18n";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo collapse />
        <nav aria-label={t("nav.mainNav")} className="hidden items-center gap-1 md:flex">
          <Link className="rounded-lg px-3 py-2 font-medium hover:bg-muted" href="/courses">
            {t("nav.courses")}
          </Link>
          <Link className="rounded-lg px-3 py-2 font-medium hover:bg-muted" href="/#how-it-works">
            {t("nav.howItWorks")}
          </Link>
          <Link className="rounded-lg px-3 py-2 font-medium hover:bg-muted" href="/#pricing">
            {t("nav.pricing")}
          </Link>
          <Link className="rounded-lg px-3 py-2 font-medium hover:bg-muted" href="/#faq">
            {t("nav.faq")}
          </Link>
        </nav>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Suspense fallback={<UserMenuFallback />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
