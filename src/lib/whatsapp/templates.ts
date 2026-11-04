/**
 * WhatsApp message templates. Business-initiated WhatsApp messages must use
 * templates pre-approved by Meta: create templates with these NAMES and the
 * same numbered {{n}} parameters in WhatsApp Manager (see docs/SETUP.md).
 * `text()` renders the same message as plain text for manual sending.
 */
export type TemplateName = "consent_request" | "payment_link" | "invoice_ready" | "refund_processed" | "weekly_summary" | "project_feedback";

type Def = { params: string[]; text: (p: string[]) => string };

export const TEMPLATES: Record<TemplateName, Def> = {
  consent_request: {
    params: ["child_name", "consent_link"],
    text: ([child, link]) =>
      `Namaste! ${child} has created an account on AI Learning Hub (hands-on AI lessons for Class 7–8). As their parent or guardian, please approve the account here: ${link}\nThe link is valid for 7 days. If you don't know about this, simply ignore this message.`,
  },
  payment_link: {
    params: ["child_name", "course_title", "amount", "pay_link"],
    text: ([child, course, amount, link]) =>
      `${child} would like to join "${course}" on AI Learning Hub (${amount}). You can pay securely here (UPI, cards, netbanking): ${link}\nThe link is valid for 7 days.`,
  },
  invoice_ready: {
    params: ["child_name", "course_title", "amount", "invoice_number", "invoice_link"],
    text: ([child, course, amount, number, link]) =>
      `Thank you! We've received ${amount} for "${course}" — it's now unlocked for ${child}. Invoice ${number}: ${link}`,
  },
  refund_processed: {
    params: ["child_name", "course_title", "amount", "credit_note_link"],
    text: ([child, course, amount, link]) =>
      `We've refunded ${amount} for "${course}" (${child}). It usually reaches your account in 5–7 working days. Credit note: ${link}`,
  },
  weekly_summary: {
    params: ["child_name", "minutes", "lessons", "streak", "highlight"],
    text: ([child, minutes, lessons, streak, highlight]) =>
      `Weekly update for ${child}: ${minutes} of active learning, ${lessons} lesson(s) completed, ${streak}-day streak. ${highlight}`,
  },
  project_feedback: {
    params: ["child_name", "lesson_title", "status", "feedback"],
    text: ([child, lesson, status, feedback]) => `${child}'s project for "${lesson}" was ${status} by the teacher. ${feedback}`.trim(),
  },
};

export function renderText(name: TemplateName, params: string[]): string {
  return TEMPLATES[name].text(params).slice(0, 2000);
}
