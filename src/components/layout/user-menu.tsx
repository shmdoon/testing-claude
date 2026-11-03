import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { homeForRole } from "@/lib/auth/roles";
import { t } from "@/i18n";

/** Reads the session — always render inside <Suspense>. */
export async function UserMenu({ showDashboardLink = true }: { showDashboardLink?: boolean }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link href="/login">{t("common.signIn")}</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/signup">{t("common.signUp")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {showDashboardLink && (
        <Button asChild variant="secondary" size="sm">
          <Link href={homeForRole(user.profile.role)}>{t("nav.dashboard")}</Link>
        </Button>
      )}
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="icon" aria-label={t("common.signOut")}>
          <LogOut aria-hidden />
        </Button>
      </form>
    </div>
  );
}

export function UserMenuFallback() {
  return <div className="h-11 w-24 animate-pulse rounded-lg bg-muted" aria-hidden />;
}
