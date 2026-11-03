import { z } from "zod";

/** Validation for each admin-editable setting (key → rule). */
export const SETTING_RULES = {
  "business.name": z.string().trim().min(1).max(200),
  "business.address": z.string().trim().min(1).max(500),
  "business.gstin": z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Not a valid GSTIN")]),
  "business.email": z.email(),
  "tax.mode": z.enum(["none", "cgst_sgst", "igst"]),
  "tax.rate_percent": z.coerce.number().min(0).max(28),
  "tax.prices_include_tax": z.enum(["true", "false"]).transform((v) => v === "true"),
  "invoice.sac_code": z.string().trim().regex(/^\d{4,8}$/, "4–8 digits"),
  "invoice.prefix": z.string().trim().regex(/^[A-Z]{2,5}$/, "2–5 capital letters"),
  "invoice.credit_note_prefix": z.string().trim().regex(/^[A-Z]{2,5}$/, "2–5 capital letters"),
  "invoice.footer": z.string().trim().max(300),
  "refund.window_days": z.coerce.number().int().min(0).max(365),
} as const;
