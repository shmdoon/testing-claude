import { z } from "zod";

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes")
  .max(80);

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** "499", "499.5", "1,299.00" → paise. */
export const rupeesToPaise = z
  .string()
  .trim()
  .transform((s) => s.replace(/[,₹\s]/g, ""))
  .pipe(z.string().regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter an amount like 499 or 499.50"))
  .transform((s) => {
    const [r, p = ""] = s.split(".");
    return Number(r) * 100 + Number(p.padEnd(2, "0"));
  });

export function paiseToRupees(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s));

export const courseFormSchema = z
  .object({
    title: z.string().trim().min(1, "Required").max(120),
    slug: slugSchema,
    subtitle: optionalText(200),
    description: optionalText(5000),
    /** One outcome per line */
    outcomes: z
      .string()
      .default("")
      .transform((s) =>
        s
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().max(200)).max(12)),
    course_type: z.enum(["mini", "big"]),
    class_levels: z.array(z.coerce.number().int().min(1).max(12)).min(1, "Pick at least one class"),
    subject: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, dashes")
      .max(40),
    is_free: z.boolean(),
    price: z.string().default(""),
  })
  .transform((v, ctx) => {
    let price_paise = 0;
    if (!v.is_free) {
      const p = rupeesToPaise.safeParse(v.price);
      if (!p.success || p.data < 100) {
        ctx.addIssue({ code: "custom", path: ["price"], message: "Paid courses cost at least ₹1" });
        return z.NEVER;
      }
      price_paise = p.data;
    }
    const { price: _price, ...rest } = v;
    void _price;
    return { ...rest, price_paise };
  });

export type CourseFormValues = z.output<typeof courseFormSchema>;

export function courseFormFromData(form: FormData) {
  return courseFormSchema.safeParse({
    title: form.get("title") ?? "",
    slug: form.get("slug") ?? "",
    subtitle: form.get("subtitle") ?? "",
    description: form.get("description") ?? "",
    outcomes: form.get("outcomes") ?? "",
    course_type: form.get("course_type"),
    class_levels: form.getAll("class_levels"),
    subject: form.get("subject") ?? "ai",
    is_free: form.get("is_free") === "on",
    price: form.get("price") ?? "",
  });
}

export const moduleFormSchema = z.object({
  title: z.string().trim().min(1, "Required").max(120),
  description: optionalText(1000),
});

export const lessonCreateSchema = z.object({
  module_id: z.uuid(),
  title: z.string().trim().min(1, "Required").max(120),
  slug: slugSchema,
});

export const lessonSettingsSchema = z.object({
  title: z.string().trim().min(1, "Required").max(120),
  slug: slugSchema,
  summary: optionalText(500),
  estimated_minutes: z.coerce.number().int().min(1).max(240),
  require_activity_first: z.boolean(),
  is_preview: z.boolean(),
});

export const reorderSchema = z.object({ parent_id: z.uuid(), ids: z.array(z.uuid()).min(1).max(200) });

export const COVER_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const COVER_MAX_BYTES = 2 * 1024 * 1024;
