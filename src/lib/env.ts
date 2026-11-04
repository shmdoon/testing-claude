import { z } from "zod";

/**
 * Typed environment access. Public values (NEXT_PUBLIC_*) are safe for the
 * browser; everything in `serverSchema` must only be read on the server via
 * `getServerEnv()` (which lives in `env.server.ts` behind `server-only`).
 */
export const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export const serverSchema = publicSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1),
  // Optional until the milestones that need them.
  AUTH_GOOGLE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Payments (M5). Leave empty to use the mock gateway on localhost.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  PAYMENTS_ALLOW_MOCK: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Email (M5). Leave RESEND_API_KEY empty to only log emails.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("AI Learning Hub <onboarding@resend.dev>"),
  SUPABASE_INVOICES_BUCKET: z.string().default("invoices"),
  // WhatsApp Business Platform (Cloud API). Empty → messages go to the admin outbox for manual sending.
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().default("en"),
  // Signs links sent to parents (invoice downloads). 32+ random bytes.
  LINK_SECRET: z.string().optional(),
  // Bearer secret for scheduled jobs (weekly WhatsApp summary).
  CRON_SECRET: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export function parseEnv<S extends z.ZodType>(schema: S, source: Record<string, string | undefined>): z.infer<S> {
  // Treat empty strings as "unset" so `.env.example` copies behave predictably.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example.`);
  }
  return result.data;
}

let cachedPublic: PublicEnv | undefined;

/** Public env. NEXT_PUBLIC_* must be referenced literally so Next can inline them. */
export function getPublicEnv(): PublicEnv {
  cachedPublic ??= parseEnv(publicSchema, {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return cachedPublic;
}
