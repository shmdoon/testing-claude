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
