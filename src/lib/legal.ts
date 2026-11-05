import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LegalVars } from "@/content/legal";
import { PENDING_RETENTION_DAYS } from "@/lib/privacy/constants";

export const SETTINGS_TAG = "settings";

const DEFAULTS: LegalVars = {
  platform_name: "AI Learning Hub",
  business_name: "[Business name] (placeholder)",
  business_address: "[Registered address] (placeholder)",
  support_email: "support@example.com",
  grievance_officer: "[Grievance officer] (placeholder)",
  grievance_email: "privacy@example.com",
  refund_window_days: "7",
  jurisdiction: "[City, State] (placeholder)",
  pending_retention_days: String(PENDING_RETENTION_DAYS),
  last_updated: "2026-11-05",
  policy_version: "draft",
};

const KEYS: Record<string, keyof LegalVars> = {
  "platform.name": "platform_name",
  "business.name": "business_name",
  "business.address": "business_address",
  "platform.support_email": "support_email",
  "legal.grievance_officer": "grievance_officer",
  "legal.grievance_email": "grievance_email",
  "refund.window_days": "refund_window_days",
  "legal.jurisdiction": "jurisdiction",
  "legal.last_updated": "last_updated",
  "consent.policy_version": "policy_version",
};

/**
 * Public legal details from settings (service role, only whitelisted keys).
 * Cached; admin settings saves call updateTag(SETTINGS_TAG).
 */
export async function getLegalInfo(): Promise<{ vars: LegalVars; reviewed: boolean }> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  const vars = { ...DEFAULTS };
  let reviewed = false;
  try {
    const { data, error } = await createAdminClient()
      .from("settings")
      .select("key, value")
      .in("key", [...Object.keys(KEYS), "legal.reviewed", "business.email"]);
    if (error) throw error;
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    for (const [k, v] of Object.entries(KEYS)) {
      const val = map[k];
      if (val !== undefined && val !== null && String(val).trim() !== "") vars[v] = String(val);
    }
    // No support email set yet → fall back to the billing email.
    if (!String(map["platform.support_email"] ?? "").trim() && map["business.email"]) vars.support_email = String(map["business.email"]);
    reviewed = map["legal.reviewed"] === true;
    cacheLife("hours");
  } catch (e) {
    console.error("legal settings unavailable", e instanceof Error ? e.message : e);
    cacheLife("seconds");
  }
  return { vars, reviewed };
}
