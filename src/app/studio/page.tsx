import { ComingSoon } from "@/components/layout/area-shell";
import { t } from "@/i18n";

export const metadata = { title: "Content Studio" };

export default function StudioHome() {
  return <ComingSoon title={t("studio.title")} milestone={2} />;
}
