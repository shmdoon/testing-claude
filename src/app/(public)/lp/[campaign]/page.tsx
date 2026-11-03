import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPage } from "@/components/marketing/landing-page";
import { campaigns, type CampaignKey } from "@/content/marketing";

/** Ad-campaign landing variants (content in src/content/marketing.ts). */
export function generateStaticParams() {
  return Object.keys(campaigns).map((campaign) => ({ campaign }));
}

export async function generateMetadata({ params }: PageProps<"/lp/[campaign]">): Promise<Metadata> {
  const { campaign } = await params;
  const c = campaigns[campaign as CampaignKey];
  if (!c) return {};
  return {
    title: { absolute: c.metaTitle },
    description: c.metaDescription,
    // Paid-traffic pages: keep them out of search results; "/" is the canonical page.
    robots: { index: false, follow: true },
    alternates: { canonical: "/" },
    openGraph: { title: c.metaTitle, description: c.metaDescription },
  };
}

export default async function CampaignPage({ params }: PageProps<"/lp/[campaign]">) {
  const { campaign } = await params;
  const c = campaigns[campaign as CampaignKey];
  if (!c) notFound();
  return <LandingPage variant={c} interest={campaign} />;
}
