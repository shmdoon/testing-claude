import { z } from "zod";

import { CLASS_LEVELS } from "@/lib/class-levels";

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

export const studentDetailsSchema = z.object({
  full_name: fullName,
  class_level: classLevel,
  parent_email: email,
});

export const signupSchema = z.discriminatedUnion("role", [
  z
    .object({ role: z.literal("student"), email })
    .extend(studentDetailsSchema.shape)
    .refine((v) => v.email !== v.parent_email, { message: "sameAsParent", path: ["parent_email"] }),
  z.object({ role: z.literal("parent"), email, full_name: fullName }),
]);

export type SignupInput = z.infer<typeof signupSchema>;

export const completeProfileSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("student") }).extend(studentDetailsSchema.shape),
  z.object({ role: z.literal("parent"), full_name: fullName }),
]);

/** FormData → plain object (single values only). */
export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}
