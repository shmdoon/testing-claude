"use client";

/**
 * Optional ad/analytics tags for PUBLIC marketing pages only (never /learn,
 * /parent, /admin, /studio). Loaded only after cookie consent and never for
 * signed-in users — so students are never tracked (brief §3, decision MK2).
 */
export const TAG_IDS = {
  ga4: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "",
  googleAds: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "",
  googleAdsLeadLabel: process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL || "",
  metaPixel: process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
};
export const anyTagConfigured = () => Boolean(TAG_IDS.ga4 || TAG_IDS.googleAds || TAG_IDS.metaPixel);

export const CONSENT_KEY = "alh_cookie_consent";
export type Consent = "granted" | "denied";

export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(v: Consent) {
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event("alh-consent"));
}

/** Supabase auth cookie present → a signed-in user (possibly a child): no tags. */
export function isSignedIn(): boolean {
  return typeof document !== "undefined" && /(^|;\s*)sb-[^=]+-auth-token/.test(document.cookie);
}

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

/** Fire a conversion if (and only if) tags are loaded. */
export function trackConversion(event: "lead" | "sign_up" | "begin_checkout", params: Record<string, string | number> = {}) {
  const w = window as unknown as { gtag?: Gtag; fbq?: Fbq };
  if (w.gtag) {
    w.gtag("event", event === "lead" ? "generate_lead" : event, params);
    if (event === "lead" && TAG_IDS.googleAds && TAG_IDS.googleAdsLeadLabel) {
      w.gtag("event", "conversion", { send_to: `${TAG_IDS.googleAds}/${TAG_IDS.googleAdsLeadLabel}` });
    }
  }
  if (w.fbq) w.fbq("track", event === "lead" ? "Lead" : event === "sign_up" ? "CompleteRegistration" : "InitiateCheckout", params);
}
