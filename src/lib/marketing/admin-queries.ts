import "server-only";
import { z } from "zod";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const leadFilterSchema = z.object({
  campaign: z.string().max(100).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
});
export type LeadFilters = z.infer<typeof leadFilterSchema>;

export function parseLeadFilters(sp: Record<string, string | string[] | undefined>): LeadFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  return leadFilterSchema.parse({ campaign: one(sp.campaign), from: one(sp.from), to: one(sp.to) });
}

export async function listLeads(f: LeadFilters, limit = 1000) {
  await requireArea("admin");
  const supabase = await createClient();
  let q = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(limit);
  if (f.campaign === "(none)") q = q.is("utm_campaign", null);
  else if (f.campaign) q = q.eq("utm_campaign", f.campaign);
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00+05:30`);
  if (f.to) q = q.lte("created_at", `${f.to}T23:59:59+05:30`);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/** Leads per campaign/source/medium (for the summary table). */
export function summarise(leads: { utm_campaign: string | null; utm_source: string | null; utm_medium: string | null; marketing_consent: boolean }[]) {
  const map = new Map<string, { campaign: string; source: string; medium: string; leads: number; optedIn: number }>();
  for (const l of leads) {
    const key = `${l.utm_campaign}|${l.utm_source}|${l.utm_medium}`;
    const row = map.get(key) ?? { campaign: l.utm_campaign ?? "(none)", source: l.utm_source ?? "(direct)", medium: l.utm_medium ?? "—", leads: 0, optedIn: 0 };
    row.leads++;
    if (l.marketing_consent) row.optedIn++;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.leads - a.leads);
}
