"use client";

import Script from "next/script";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { TAG_IDS, anyTagConfigured, isSignedIn, readConsent, writeConsent, type Consent } from "@/lib/marketing/tags";
import { t } from "@/i18n";

const subscribe = (cb: () => void) => {
  window.addEventListener("alh-consent", cb);
  return () => window.removeEventListener("alh-consent", cb);
};

/** Consent banner + consent-gated GA4 / Google Ads / Meta Pixel. Renders nothing if no IDs are set. */
export function MarketingTags() {
  const consent = useSyncExternalStore<Consent | null | "unknown">(subscribe, readConsent, () => "unknown");
  const signedIn = useSyncExternalStore(subscribe, isSignedIn, () => true);
  if (!anyTagConfigured() || signedIn || consent === "unknown") return null;

  if (consent === null) {
    return (
      <div role="dialog" aria-label={t("marketing.cookieTitle")} className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-xl rounded-2xl border bg-card p-4 shadow-xl sm:bottom-4">
        <p className="text-sm">
          {t("marketing.cookieBody")}{" "}
          <Link href="/legal/privacy" className="font-semibold underline">
            {t("legal.privacy")}
          </Link>
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => writeConsent("granted")}>
            {t("marketing.cookieAccept")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => writeConsent("denied")}>
            {t("marketing.cookieDecline")}
          </Button>
        </div>
      </div>
    );
  }
  if (consent !== "granted") return null;

  const gId = TAG_IDS.ga4 || TAG_IDS.googleAds;
  return (
    <>
      {gId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gId)}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());${TAG_IDS.ga4 ? `gtag('config',${JSON.stringify(TAG_IDS.ga4)},{anonymize_ip:true});` : ""}${TAG_IDS.googleAds ? `gtag('config',${JSON.stringify(TAG_IDS.googleAds)});` : ""}`}
          </Script>
        </>
      )}
      {TAG_IDS.metaPixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(TAG_IDS.metaPixel)});fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
