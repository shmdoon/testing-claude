import { Award, LayoutDashboard, UserRound } from "lucide-react";
import { AreaShell } from "@/components/layout/area-shell";
import { t } from "@/i18n";

export default function LearnLayout({ children }: LayoutProps<"/learn">) {
  return (
    <AreaShell
      area="learn"
      label={t("nav.dashboard")}
      nav={[
        { href: "/learn", label: t("nav.dashboard"), icon: <LayoutDashboard />, exact: true },
        { href: "/learn/achievements", label: t("nav.achievements"), icon: <Award /> },
        { href: "/learn/profile", label: t("nav.profile"), icon: <UserRound /> },
      ]}
    >
      {children}
    </AreaShell>
  );
}
