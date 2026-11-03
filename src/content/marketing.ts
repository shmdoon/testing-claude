/**
 * Marketing content that the team edits without touching page code.
 *
 * - `campaigns`: landing variants for ads, served at /lp/<key>. Each can tweak
 *   the hero and calls to action; all other sections come from the main page.
 *   Point each ad group at its own variant and tag the URL with utm_* params.
 * - `testimonials` / `stats`: shown ONLY when filled in. Use real, permitted
 *   quotes and real numbers — never invent social proof.
 */
export type Campaign = {
  /** Shown as the small label above the headline. */
  eyebrow?: string;
  headline: string;
  subheadline: string;
  ctaPrimary?: string;
  /** Where the main button goes: the lead form (default) or straight to the free course. */
  primaryTarget?: "lead" | "free-course";
  /** <title> / meta description for this variant. */
  metaTitle: string;
  metaDescription: string;
};

export const campaigns = {
  "ai-for-kids": {
    headline: "AI for kids, explained by doing",
    subheadline: "Hands-on AI lessons for Class 7 & 8. Kids sort, match and build first — then learn the idea behind it.",
    metaTitle: "AI for kids (Class 7–8) — learn by doing",
    metaDescription: "Short, hands-on AI lessons for ages 12–14. Safe, ad-free, parent-approved. Try a free lesson.",
  },
  "future-skills": {
    eyebrow: "Future-ready skills",
    headline: "The skill every career will need — taught the way kids actually learn",
    subheadline: "Your child learns how AI works, where it goes wrong, and how to use it well. 10–30 minute lessons, no coding needed.",
    metaTitle: "Future-ready AI skills for Class 7–8",
    metaDescription: "Activity-first AI courses for ages 12–14. Parent dashboard, GST invoices, no ads. Free taster course.",
  },
  "screen-time": {
    eyebrow: "Better screen time",
    headline: "Turn screen time into building time",
    subheadline: "Instead of scrolling, your child makes things — and learns how the AI behind their apps really works.",
    ctaPrimary: "Start the free course",
    primaryTarget: "free-course",
    metaTitle: "Turn screen time into building time — AI for kids",
    metaDescription: "Hands-on AI projects for ages 12–14. Safe, ad-free, approved by you. Start free.",
  },
} as const satisfies Record<string, Campaign>;

export type CampaignKey = keyof typeof campaigns;

export type Testimonial = { quote: string; name: string; detail: string };
/** Add real, permitted testimonials here (e.g. "Priya, parent of a Class 8 student"). */
export const testimonials: Testimonial[] = [];

export type Stat = { value: string; label: string };
/** Add real numbers only (e.g. { value: "1,200+", label: "lessons completed" }). */
export const stats: Stat[] = [];

/** The free course used for "try a free lesson" calls to action. */
export const FREE_COURSE_SLUG = "what-is-ai";
