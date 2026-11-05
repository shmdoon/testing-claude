/**
 * Legal page drafts. Written for India (DPDP Act 2023, Consumer Protection
 * (E-Commerce) Rules 2020, CGST Act) and for a service used by children.
 * THESE ARE DRAFTS — have a lawyer review them, then set `legal.reviewed` to
 * true in /admin/settings to remove the draft banner.
 *
 * `{{key}}` placeholders are filled from settings (see LegalVars).
 */

export type LegalVars = {
  platform_name: string;
  business_name: string;
  business_address: string;
  support_email: string;
  grievance_officer: string;
  grievance_email: string;
  refund_window_days: string;
  jurisdiction: string;
  pending_retention_days: string;
  last_updated: string;
  policy_version: string;
};

export type LegalSection = { id: string; heading: string; body: string };
export type LegalDoc = { slug: "privacy" | "terms" | "refund"; title: string; summary: string[]; sections: LegalSection[] };

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy policy",
  summary: [
    "We collect only what we need to teach: the student's name, class and email, and a parent's name, WhatsApp number and (optionally) email.",
    "A parent must approve every student account before it can be used.",
    "No ads, no tracking and no selling of data — ever. Students never see third-party ads or trackers.",
    "You can download your data or ask us to delete it at any time.",
  ],
  sections: [
    {
      id: "who",
      heading: "1. Who we are",
      body: `{{platform_name}} is run by **{{business_name}}**, {{business_address}} ("we", "us"). We are the *data fiduciary* for the personal data described here under India's Digital Personal Data Protection Act, 2023 (DPDP Act).

Questions: {{support_email}}. Privacy requests and complaints: our Grievance Officer, **{{grievance_officer}}**, {{grievance_email}}.`,
    },
    {
      id: "children",
      heading: "2. Children and parental consent",
      body: `Our students are in Class 7–8 (about 12–14 years old), so they are children under the DPDP Act. Because of this:

- **A parent or legal guardian must approve the account.** After the student confirms their email, we send the parent a WhatsApp message with a one-time link to approve. Until then the student cannot start lessons, save work or buy courses.
- If no parent approves within **{{pending_retention_days}} days**, we delete the account automatically.
- We do **not** track students across websites, build behavioural profiles, or show targeted advertising to students. Analytics and advertising tags never load for signed-in students.
- Payments must be made by an adult (parent or guardian).`,
    },
    {
      id: "what",
      heading: "3. What we collect and why",
      body: `- **Student name, class and email** — to run the account, sign in and show age-appropriate lessons.
- **Parent name, WhatsApp number and email (optional)** — for approval, payment links, invoices and progress updates.
- **Lesson progress, quiz and activity answers, projects you submit** — to teach, and so teachers can give feedback.
- **Time actively spent on lessons** (and an *estimate* of time on linked external sites) — for progress reports.
- **Orders, payer details and invoices** — to take payment and keep tax records (required by GST law).
- **Campaign source of a visit to our public pages** (e.g. "google / cpc") — to know which ads work; only with cookie consent and never linked to a student's learning.

Everything except tax records and cookies is processed on the basis of the parent's consent.

We do not collect phone numbers of students, their location, photos of their faces, or school names. Photos you upload as project screenshots have hidden location (EXIF) data removed.`,
    },
    {
      id: "whatsapp",
      heading: "4. WhatsApp messages",
      body: `We message parents on WhatsApp (via Meta's WhatsApp Business Platform) for: account approval, payment links, invoices and refunds, and — only if the parent opts in — a weekly progress summary and teacher feedback on projects. Message us any time to turn updates off. Approval and payment messages are part of the service.`,
    },
    {
      id: "sharing",
      heading: "5. Who we share data with",
      body: `We never sell personal data. We use these service providers (data processors), bound by contract to use the data only for us:

- **Supabase** — database, sign-in and file storage
- **Razorpay** — payments (we never see or store card or UPI details)
- **Meta (WhatsApp Business Platform)** — messages to parents
- **Resend** — emails (sign-in codes, invoices)
- **Our hosting provider** (Vercel or Cloudflare) — runs the website

Some lessons send students to well-known external tools (for example a website builder). Students open these in a new tab and use them under that site's own terms and privacy policy; we do not send them any of the student's data. Tools with a minimum age above the student's age are shown only as a "do this with a parent" activity.

We may disclose data if the law requires it.`,
    },
    {
      id: "retention",
      heading: "6. How long we keep data",
      body: `- Account and learning data: while the account is active, and deleted when you ask (see below).
- Accounts never approved by a parent: deleted after {{pending_retention_days}} days.
- Invoices and payment records: kept for the period required by GST law (currently at least 72 months after the annual return for that year), even after an account is deleted. Only what appears on the invoice is kept.
- Proof that a parent gave consent (date, method, policy version) is kept without contact details.`,
    },
    {
      id: "rights",
      heading: "7. Your rights",
      body: `A student and their parent can:

- **Get a copy** of the data we hold — students can download it any time from *Profile → Your data*.
- **Correct** it — change your name on the Profile page, or message us.
- **Delete** it — use *Profile → Delete my account*, or the parent can message us on WhatsApp or email {{grievance_email}}. We confirm with the parent and complete deletion within 30 days.
- **Withdraw consent** — message us; we will stop processing and delete the account as above.
- **Complain** — contact our Grievance Officer ({{grievance_email}}). We acknowledge within 48 hours and aim to resolve within 30 days. If you are not satisfied you can approach the Data Protection Board of India.
- **Nominate** someone to exercise these rights on your behalf.`,
    },
    {
      id: "security",
      heading: "8. Security",
      body: `Data is encrypted in transit (HTTPS) and at rest. Every database table is protected by access rules so students only see their own data. Uploaded files are private and shared only through short-lived links. Staff access is limited to what their role needs, and sensitive admin actions are logged. If a personal data breach happens we will inform affected users and the Data Protection Board as the law requires.`,
    },
    {
      id: "cookies",
      heading: "9. Cookies",
      body: `We use essential cookies to keep you signed in and to protect forms. On our public pages for parents we may use analytics and advertising cookies (Google Analytics, Google Ads, Meta Pixel) **only after you accept them** in the cookie banner. These never load inside the learning area.`,
    },
    {
      id: "changes",
      heading: "10. Changes",
      body: `If we make important changes we will tell parents on WhatsApp and, where needed, ask for consent again. Version {{policy_version}}, last updated {{last_updated}}.`,
    },
  ],
};

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of use",
  summary: [
    "Students need a parent's approval to use the platform; payments are made by an adult.",
    "Be kind, keep your account to yourself, and only submit your own work.",
    "Your projects stay yours.",
  ],
  sections: [
    {
      id: "agreement",
      heading: "1. Agreement",
      body: `These terms are an agreement between **{{business_name}}** ({{business_address}}) and the parent or guardian who approves a student's account, on their own behalf and on behalf of the student. Using {{platform_name}} means you accept these terms and our [privacy policy](/legal/privacy).`,
    },
    {
      id: "accounts",
      heading: "2. Accounts",
      body: `- One account per student. Keep sign-in codes private.
- Information you give (name, class, parent contact) must be true.
- The account only becomes active after a parent or guardian approves it.
- We may suspend an account that breaks these terms, after telling the parent where possible.`,
    },
    {
      id: "use",
      heading: "3. Using the platform",
      body: `Students must not: share other people's personal information, upload anything unkind, unsafe or not their own, try to break or bypass security, or use the platform for anything illegal. Teachers review submitted projects; projects only appear in the class gallery with the student's choice **and** a parent's permission, showing first name and class only.`,
    },
    {
      id: "external",
      heading: "4. External tools",
      body: `Some activities use other websites. They open in a new tab and are governed by their own terms. We choose tools carefully and show age limits, but we are not responsible for third-party sites. Parents should help with any tool marked "with a parent".`,
    },
    {
      id: "content",
      heading: "5. Content and projects",
      body: `Our lessons, activities and materials belong to us or our licensors and are for personal, non-commercial learning. Projects a student creates belong to the student; they give us permission to store and show them to their teachers (and in the gallery only if allowed).`,
    },
    {
      id: "payments",
      heading: "6. Payments",
      body: `Prices are in Indian rupees and include applicable GST. Payment is processed by Razorpay and must be made by a parent or guardian (18+). Access to a paid course starts once payment is confirmed. Refunds follow our [refund policy](/legal/refund).`,
    },
    {
      id: "liability",
      heading: "7. Our responsibility",
      body: `We work hard to keep the platform available and accurate, but it is provided "as is". To the extent the law allows, our total liability for any claim is limited to the amount paid for the course concerned. Nothing here limits rights you have under the Consumer Protection Act, 2019.`,
    },
    {
      id: "law",
      heading: "8. Law, complaints and changes",
      body: `These terms are governed by the laws of India; courts at {{jurisdiction}} have jurisdiction. Complaints: {{support_email}} — we acknowledge within 48 hours and aim to resolve within 30 days (Grievance Officer: {{grievance_officer}}, {{grievance_email}}). We will tell parents about important changes. Last updated {{last_updated}}.`,
    },
  ],
};

export const REFUND: LegalDoc = {
  slug: "refund",
  title: "Refund and cancellation policy",
  summary: [
    "Full refund within {{refund_window_days}} days of purchase — just ask.",
    "Refunds go back to the original payment method.",
    "You receive a credit note on WhatsApp; course access ends when the refund is made.",
  ],
  sections: [
    {
      id: "window",
      heading: "1. When you can get a refund",
      body: `You can ask for a full refund within **{{refund_window_days}} days** of buying a course, for any reason. After that we may still refund if the course could not be used because of a problem on our side (for example the course was withdrawn or a technical fault we could not fix).`,
    },
    {
      id: "how",
      heading: "2. How to ask",
      body: `Message us on WhatsApp from the number you paid with, or email {{support_email}} with the student's name and the invoice number.`,
    },
    {
      id: "processing",
      heading: "3. What happens next",
      body: `- We confirm within 2 working days.
- The money goes back to the original payment method through Razorpay, usually within 5–7 working days (your bank may take longer).
- We send a **credit note** (the GST document for a refund) on WhatsApp.
- Access to the refunded course ends. Progress already made is kept unless you ask us to delete it.`,
    },
    {
      id: "free",
      heading: "4. Free courses and cancellations",
      body: `Free courses have nothing to refund. Courses are one-time purchases — there are no subscriptions to cancel. Last updated {{last_updated}}.`,
    },
  ],
};

export const LEGAL_DOCS = { privacy: PRIVACY, terms: TERMS, refund: REFUND } as const;

/** Replace `{{key}}` with values; unknown keys are left visible so gaps get noticed. */
export function fillLegal(text: string, vars: LegalVars): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? vars[k as keyof LegalVars] : m));
}

/** Values that still look like placeholders (shown in the draft banner for admins to fix). */
export function placeholderGaps(vars: LegalVars): (keyof LegalVars)[] {
  return (Object.keys(vars) as (keyof LegalVars)[]).filter((k) => /placeholder|example\.com|^\[|^$/i.test(vars[k]));
}
