import "server-only";
import { getServerEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Attachment = { filename: string; content: Uint8Array };
export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  related?: { type: string; id: string };
  attachments?: Attachment[];
};

/**
 * Transactional email via Resend's REST API (no SDK). Without RESEND_API_KEY
 * the email is only logged — `email_log` records every attempt either way
 * (recipient, template, subject, status — never the body).
 */
export async function sendEmail(input: EmailInput): Promise<{ status: "sent" | "logged" | "failed"; id?: string }> {
  const env = getServerEnv();
  let status: "sent" | "logged" | "failed" = "logged";
  let providerId: string | undefined;
  let error: string | undefined;

  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
          attachments: input.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (res.ok) {
        status = "sent";
        providerId = json.id;
      } else {
        status = "failed";
        error = json.message ?? `HTTP ${res.status}`;
      }
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : "send failed";
    }
  } else {
    console.info(`[email:logged] ${input.template} → ${input.to}: ${input.subject}`);
  }

  await createAdminClient()
    .from("email_log")
    .insert({
      to_email: input.to,
      template: input.template,
      subject: input.subject.slice(0, 200),
      status,
      provider_id: providerId ?? null,
      error: error?.slice(0, 1000) ?? null,
      related_type: input.related?.type ?? null,
      related_id: input.related?.id ?? null,
    });
  return { status, id: providerId };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Minimal, accessible email layout. All dynamic values are escaped. */
export function emailLayout(title: string, paragraphs: string[], action?: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5">${esc(p)}</p>`).join("");
  const button = action
    ? `<p style="margin:20px 0"><a href="${esc(action.url)}" style="background:#4338ca;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${esc(action.label)}</a></p>`
    : "";
  return {
    html: `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#1e293b"><div style="max-width:560px;margin:0 auto;padding:24px"><h1 style="font-size:22px">${esc(title)}</h1>${body}${button}<p style="font-size:12px;color:#64748b">AI Learning Hub · no ads, no trackers</p></div></body></html>`,
    text: [title, "", ...paragraphs, action ? `${action.label}: ${action.url}` : ""].join("\n"),
  };
}
