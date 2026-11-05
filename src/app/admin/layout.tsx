import { Activity, ShieldCheck, AppWindow, Inbox, Megaphone, MessageCircle, CreditCard, FileText, GaugeCircle, GraduationCap, Settings, TicketPercent, UserCog } from "lucide-react";
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
        { href: "/admin/submissions", label: t("nav.submissions"), icon: <Inbox /> },
        { href: "/admin/whatsapp", label: t("nav.whatsapp"), icon: <MessageCircle /> },
        { href: "/admin/payments", label: t("nav.payments"), icon: <CreditCard /> },
        { href: "/admin/invoices", label: t("nav.invoices"), icon: <FileText /> },
        { href: "/admin/coupons", label: t("nav.coupons"), icon: <TicketPercent /> },
        { href: "/admin/leads", label: t("nav.leads"), icon: <Megaphone /> },
        { href: "/admin/users", label: t("nav.users"), icon: <UserCog /> },
        { href: "/admin/deletions", label: t("nav.deletions"), icon: <ShieldCheck /> },
        { href: "/admin/tools", label: t("nav.tools"), icon: <AppWindow /> },
        { href: "/admin/settings", label: t("nav.settings"), icon: <Settings /> },
      ]}
    >
      {children}
    </AreaShell>
  );
}
