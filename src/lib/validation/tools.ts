import { z } from "zod";
import { slugSchema } from "./content";

const domainPattern = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/, "Use a hostname like example.com or *.netlify.app");

export const toolFormSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1, "Required").max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .transform((s) => s || null),
  base_url: z.url({ protocol: /^https$/, message: "Must be an https:// URL" }),
  logo_url: z
    .string()
    .trim()
    .transform((s) => s || null)
    .pipe(z.url({ protocol: /^https$/, message: "Must be an https:// URL" }).nullable()),
  submission_domains: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split(/[\s,]+/)
        .map((d) => d.trim())
        .filter(Boolean),
    )
    .pipe(z.array(domainPattern).max(10)),
  min_age: z.coerce.number().int().min(0).max(21),
  requires_account: z.boolean(),
  enabled: z.boolean(),
});

export function toolFormFromData(form: FormData) {
  return toolFormSchema.safeParse({
    slug: form.get("slug") ?? "",
    name: form.get("name") ?? "",
    description: form.get("description") ?? "",
    base_url: form.get("base_url") ?? "",
    logo_url: form.get("logo_url") ?? "",
    submission_domains: form.get("submission_domains") ?? "",
    min_age: form.get("min_age"),
    requires_account: form.get("requires_account") === "on",
    enabled: form.get("enabled") === "on",
  });
}
