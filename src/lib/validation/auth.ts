import { z } from "zod";

import { CLASS_LEVELS } from "@/lib/class-levels";
import { normalizePhone } from "@/lib/phone";

export { CLASS_LEVELS };

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "invalidEmail" }).max(254));

const fullName = z.string().trim().min(1, { message: "required" }).max(120, { message: "required" });

export const emailSchema = z.object({ email });

export const otpSchema = z.object({
  email,
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { message: "invalidCode" }),
  next: z.string().optional(),
});

const classLevel = z.coerce
  .number()
  .int()
  .refine((n) => (CLASS_LEVELS as readonly number[]).includes(n), { message: "invalidClass" });

const parentPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "invalidPhone" });
      return z.NEVER;
    }
    return n;
  });

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((v) => v || undefined)
  .pipe(z.email({ message: "invalidEmail" }).max(254).optional());

/** What we ask about the parent/guardian (WhatsApp is the main channel). */
export const studentDetailsSchema = z.object({
  full_name: fullName,
  class_level: classLevel,
  parent_name: z.string().trim().max(120).optional().transform((v) => v || undefined),
  parent_phone: parentPhone,
  parent_email: optionalEmail,
  whatsapp_opt_in: z.literal("on", { message: "optInRequired" }),
});

export const signupSchema = z
  .object({ email })
  .extend(studentDetailsSchema.shape)
  .refine((v) => v.email !== v.parent_email, { message: "sameAsParent", path: ["parent_email"] });

export type SignupInput = z.infer<typeof signupSchema>;

export const completeProfileSchema = studentDetailsSchema;

/** FormData → plain object (single values only). */
export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
