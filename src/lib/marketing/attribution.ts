import { z } from "zod";

/**
 * First-touch campaign attribution. Captured from the landing URL by the proxy
 * into an httpOnly first-party cookie (90 days), then attached to leads and
 * signups. No third-party cookies; click ids are only noted by *type*.
 */
export const ATTRIBUTION_COOKIE = "alh_attr";
export const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 90;

const short = z.string().trim().max(100).optional();
export const attributionSchema = z.object({
  utm_source: short,
  utm_medium: short,
  utm_campaign: short,
  utm_term: short,
  utm_content: short,
  click_id_type: z.enum(["gclid", "fbclid"]).optional(),
  landing_path: z.string().max(200).optional(),
  referrer_host: z.string().max(200).optional(),
});
export type Attribution = z.infer<typeof attributionSchema>;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

/** Returns attribution if the URL carries campaign parameters, else null. */
export function attributionFromUrl(url: URL, referrer: string | null): Attribution | null {
  const out: Attribution = {};
  for (const k of UTM_KEYS) {
    const v = url.searchParams.get(k)?.trim();
    if (v) out[k] = v.slice(0, 100);
  }
  if (url.searchParams.get("gclid")) out.click_id_type = "gclid";
  else if (url.searchParams.get("fbclid")) out.click_id_type = "fbclid";
  if (Object.keys(out).length === 0) return null;
  out.landing_path = url.pathname.slice(0, 200);
  if (referrer) {
    try {
      const host = new URL(referrer).hostname;
      if (host && host !== url.hostname) out.referrer_host = host.slice(0, 200);
    } catch {
      /* ignore bad referrers */
    }
  }
  return out;
}

export function encodeAttribution(a: Attribution): string {
  return Buffer.from(JSON.stringify(a)).toString("base64url");
}

export function decodeAttribution(raw: string | undefined): Attribution | null {
  if (!raw) return null;
  try {
    const parsed = attributionSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString()));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
