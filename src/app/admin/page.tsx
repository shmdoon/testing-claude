import { ComingSoon } from "@/components/layout/area-shell";
import { t } from "@/i18n";

export const metadata = { title: "Admin" };

export default function AdminHome() {
  return <ComingSoon title={t("admin.title")} milestone={6} />;
}
