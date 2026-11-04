import "server-only";
import { getServerEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderText, TEMPLATES, type TemplateName } from "./templates";

export type WaResult = { status: "sent" | "manual" | "failed"; id: string };

export function whatsappMode(): "api" | "manual" {
  const env = getServerEnv();
  return env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID ? "api" : "manual";
}

/**
 * Send a template message to a parent. With API keys: WhatsApp Cloud API.
 * Without keys — or if the API call fails — the message is queued in the
 * admin outbox (/admin/whatsapp) with a one-tap click-to-chat link ("Both").
 */
export async function sendWhatsApp(input: {
  to: string;
  template: TemplateName;
  params: string[];
  studentId?: string;
  related?: { type: string; id: string };
}): Promise<WaResult> {
  if (input.params.length !== TEMPLATES[input.template].params.length) throw new Error(`Wrong params for ${input.template}`);
  const env = getServerEnv();
  const body = renderText(input.template, input.params);
  let status: "sent" | "manual" = "manual";
  let providerId: string | null = null;
  let error: string | null = null;

  if (whatsappMode() === "api") {
    try {
      const res = await fetch(`https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.to.replace(/\D/g, ""),
          type: "template",
          template: {
            name: input.template,
            language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE },
            components: [{ type: "body", parameters: input.params.map((p) => ({ type: "text", text: p.slice(0, 1000) })) }],
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
      if (res.ok && json.messages?.[0]?.id) {
        status = "sent";
        providerId = json.messages[0].id;
      } else {
        error = json.error?.message ?? `HTTP ${res.status}`; // falls back to the manual outbox
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "send failed";
    }
  }

  const { data } = await createAdminClient()
    .from("whatsapp_messages")
    .insert({
      student_id: input.studentId ?? null,
      to_phone: input.to,
      template: input.template,
      params: input.params,
      body,
      status,
      provider_id: providerId,
      error: error?.slice(0, 1000) ?? null,
      related_type: input.related?.type ?? null,
      related_id: input.related?.id ?? null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) console.error(`[whatsapp] ${input.template} → manual outbox: ${error}`);
  return { status: status === "sent" ? "sent" : error ? "failed" : "manual", id: data?.id ?? "" };
}
