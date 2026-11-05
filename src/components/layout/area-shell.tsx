import { Suspense } from "react";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";
import { UserMenu, UserMenuFallback } from "./user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { requireArea } from "@/lib/auth/dal";
import { PROTECTED_PREFIXES, type Area } from "@/lib/auth/roles";
import { t } from "@/i18n";

export type AreaNavItem = { href: string; label: string; icon: React.ReactNode; exact?: boolean; match?: string[] };

/**
 * Shared chrome for /learn, /parent, /admin and /studio. The chrome is static
 * (prerendered); the page content streams in only after the server-side role
 * gate passes, so nothing protected renders for the wrong role.
 */
export function AreaShell({
  area,
  label,
  nav,
  children,
}: {
  area: Area;
  label: string;
  nav: AreaNavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col" data-area={area}>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Logo href={PROTECTED_PREFIXES[area]} />
            <Badge variant="outline" className="hidden sm:inline-flex">
              {label}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Suspense fallback={<UserMenuFallback />}>
              <UserMenu showDashboardLink={false} />
            </Suspense>
          </div>
        </div>
        <nav aria-label={t("nav.areaNav")} className="mx-auto max-w-6xl overflow-x-auto px-4 pb-2">
          <ul className="flex gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} exact={item.exact} match={item.match}>
                  <span aria-hidden className="[&_svg]:size-5">
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Suspense fallback={<PageSkeleton />}>
          <AreaGate area={area}>{children}</AreaGate>
        </Suspense>
      </main>
    </div>
  );
}

async function AreaGate({ area, children }: { area: Area; children: React.ReactNode }) {
  await requireArea(area, PROTECTED_PREFIXES[area]);
  return <>{children}</>;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-36 animate-pulse rounded-2xl bg-muted" />
        <div className="h-36 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {description && <p className="text-muted-foreground">{description}</p>}
    </div>
  );
}
