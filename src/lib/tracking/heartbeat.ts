import { z } from "zod";

export const heartbeatSchema = z.object({
  course_id: z.uuid(),
  lesson_id: z.uuid().nullable(),
  block_id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,40}$/)
    .nullable(),
  seconds: z.number().int().min(1).max(30),
  flush: z.boolean().default(false),
});

export const MAX_BODY_BYTES = 1024;

/** Same-origin check for cookie-authenticated beacons (blocks cross-site inflation). */
export function isSameOrigin(origin: string | null, referer: string | null, host: string | null, siteUrl: string): boolean {
  const allowed = new Set([new URL(siteUrl).origin]);
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }
  const source = origin ?? (referer ? new URL(referer).origin : null);
  return source !== null && allowed.has(source);
}
