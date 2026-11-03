import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/landing-page";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: { absolute: `${t("common.appName")} — AI lessons for Class 7 & 8, learn by doing` },
  description: t("marketing.heroSubtitle"),
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <LandingPage />;
}
