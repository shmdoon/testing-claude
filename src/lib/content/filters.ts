import { z } from "zod";
import type { CatalogCourse } from "./catalog";

export const catalogFilterSchema = z.object({
  class: z.coerce.number().int().min(1).max(12).optional().catch(undefined),
  type: z.enum(["mini", "big"]).optional().catch(undefined),
  price: z.enum(["free", "paid"]).optional().catch(undefined),
  subject: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .optional()
    .catch(undefined),
});
export type CatalogFilters = z.infer<typeof catalogFilterSchema>;

export function parseFilters(sp: Record<string, string | string[] | undefined>): CatalogFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  return catalogFilterSchema.parse({ class: first(sp.class), type: first(sp.type), price: first(sp.price), subject: first(sp.subject) });
}

export function filterCourses(courses: CatalogCourse[], f: CatalogFilters): CatalogCourse[] {
  return courses.filter(
    (c) =>
      (f.class === undefined || c.class_levels.includes(f.class)) &&
      (!f.type || c.course_type === f.type) &&
      (!f.price || (f.price === "free") === c.is_free) &&
      (!f.subject || c.subject === f.subject),
  );
}
