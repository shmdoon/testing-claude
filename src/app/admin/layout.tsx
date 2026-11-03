import { Activity, CreditCard, FileText, GaugeCircle, GraduationCap, TicketPercent, UserCog } from "lucide-react";
import { AreaShell } from "@/components/layout/area-shell";
import { t } from "@/i18n";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AreaShell
      area="admin"
      label="Admin"
      nav={[
        { href: "/admin", label: t("nav.overview"), icon: <GaugeCircle />, exact: true },
        { href: "/admin/students", label: t("nav.students"), icon: <GraduationCap /> },
        { href: "/admin/engagement", label: t("nav.engagement"), icon: <Activity /> },
        { href: "/admin/payments", label: t("nav.payments"), icon: <CreditCard /> },
        { href: "/admin/invoices", label: t("nav.invoices"), icon: <FileText /> },
        { href: "/admin/coupons", label: t("nav.coupons"), icon: <TicketPercent /> },
        { href: "/admin/users", label: t("nav.users"), icon: <UserCog /> },
      ]}
    >
      {children}
    </AreaShell>
  );
}
