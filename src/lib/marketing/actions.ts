"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env.server";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";
import { emailLayout, sendEmail } from "@/lib/email/send";
import { echoOnError, type FormValues } from "@/lib/forms";
import { FREE_COURSE_SLUG } from "@/content/marketing";
import { ATTRIBUTION_COOKIE, decodeAttribution } from "./attribution";

export type LeadState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; values?: FormValues };

const leadSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "Enter a valid email address." }).max(254)),
  name: z.string().trim().max(120).optional(),
  child_class: z.union([z.literal(""), z.coerce.number().int().min(1).max(12)]).optional(),
  adult: z.literal("on", { message: "adult" }),
  consent: z.literal("on").optional(),
  // Honeypot: real people never see or fill this field.
  website: z.string().max(0).optional(),
  interest: z.string().trim().max(60).optional(),
});

export async function submitLead(_prev: LeadState, form: FormData): Promise<LeadState> {
  return echoOnError<LeadState>(form, async () => {
    const raw = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
    const parsed = leadSchema.safeParse(raw);
    if (!parsed.success) {
      if (raw.website) return { ok: true }; // bots get a fake success
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
      return { fieldErrors };
    }
    const d = parsed.data;
    const ip = await getClientIp();
    if (!(await rateLimit(`lead:ip:${ip}`, 5, 600)) || !(await rateLimit(`lead:email:${d.email}`, 3, 3600))) {
      return { error: "Too many requests. Please try again later." };
    }

    const attr = decodeAttribution((await cookies()).get(ATTRIBUTION_COOKIE)?.value) ?? {};
    const admin = createAdminClient();
    const { error } = await admin.from("leads").insert({
      parent_email: d.email,
      parent_name: d.name || null,
      child_class: typeof d.child_class === "number" ? d.child_class : null,
      interest: d.interest || null,
      marketing_consent: d.consent === "on",
      consent_at: d.consent === "on" ? new Date().toISOString() : null,
      ...attr,
    });
    if (error) {
      console.error("lead insert failed", error.message);
      return { error: "generic" };
    }

    const site = getServerEnv().NEXT_PUBLIC_SITE_URL;
    const { html, text } = emailLayout(
      "Your free AI lesson is ready",
      [
        `Hi${d.name ? ` ${d.name}` : ""}! Here's the free taster course: two short, hands-on lessons where your child tries an activity first and learns the idea behind it.`,
        "Your child signs up with their own email and your WhatsApp number; you'll get a WhatsApp message to approve the account.",
      ],
      { label: "Open the free course", url: `${site}/courses/${FREE_COURSE_SLUG}` },
    );
    await sendEmail({ to: d.email, subject: "Your free AI lesson for your child", html, text, template: "lead_welcome", related: { type: "lead", id: d.email } });
    return { ok: true };
  });
}
