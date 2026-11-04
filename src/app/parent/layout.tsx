import { Images, Receipt, Users } from "lucide-react";
import { AreaShell } from "@/components/layout/area-shell";
import { t } from "@/i18n";

export default function ParentLayout({ children }: LayoutProps<"/parent">) {
  return (
    <AreaShell
      area="parent"
      label={t("auth.roleParent")}
      nav={[
        { href: "/parent", label: t("nav.children"), icon: <Users />, exact: true },
        { href: "/parent/purchases", label: t("nav.purchases"), icon: <Receipt /> },
        { href: "/parent/gallery", label: t("nav.gallery"), icon: <Images /> },
      ]}
    >
      {children}
    </AreaShell>
  );
}
