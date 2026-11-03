import { Users } from "lucide-react";
import { AreaShell } from "@/components/layout/area-shell";
import { t } from "@/i18n";

export default function ParentLayout({ children }: LayoutProps<"/parent">) {
  return (
    <AreaShell
      area="parent"
      label={t("auth.roleParent")}
      nav={[{ href: "/parent", label: t("nav.children"), icon: <Users />, exact: true }]}
    >
      {children}
    </AreaShell>
  );
}
