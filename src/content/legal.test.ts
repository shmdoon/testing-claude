import { describe, expect, it } from "vitest";
import { LEGAL_DOCS, fillLegal, placeholderGaps, type LegalVars } from "./legal";

const vars: LegalVars = {
  platform_name: "AI Learning Hub",
  business_name: "Acme Learning Pvt Ltd",
  business_address: "1 MG Road, Bengaluru, KA 560001",
  support_email: "help@acme.in",
  grievance_officer: "R. Sharma",
  grievance_email: "privacy@acme.in",
  refund_window_days: "7",
  jurisdiction: "Bengaluru, Karnataka",
  pending_retention_days: "30",
  last_updated: "2026-11-05",
  policy_version: "2026-11",
};

describe("legal docs", () => {
  it("every placeholder used in the docs is a known variable", () => {
    for (const doc of Object.values(LEGAL_DOCS)) {
      const text = [...doc.summary, ...doc.sections.map((s) => s.body)].join("\n");
      expect(fillLegal(text, vars)).not.toMatch(/\{\{\w+\}\}/);
    }
  });
  it("section ids are unique per document", () => {
    for (const doc of Object.values(LEGAL_DOCS)) expect(new Set(doc.sections.map((s) => s.id)).size).toBe(doc.sections.length);
  });
  it("privacy policy covers the DPDP essentials", () => {
    const ids = LEGAL_DOCS.privacy.sections.map((s) => s.id);
    for (const id of ["who", "children", "what", "sharing", "retention", "rights", "security"]) expect(ids).toContain(id);
    expect(fillLegal(LEGAL_DOCS.privacy.sections[0]!.body, vars)).toContain("R. Sharma");
  });
  it("unknown placeholders stay visible", () => {
    expect(fillLegal("Hi {{nope}}", vars)).toBe("Hi {{nope}}");
  });
  it("flags values that still look like placeholders", () => {
    expect(placeholderGaps(vars)).toEqual([]);
    expect(placeholderGaps({ ...vars, business_name: "[Business name] (placeholder)", grievance_email: "privacy@example.com", jurisdiction: "" })).toEqual([
      "business_name",
      "grievance_email",
      "jurisdiction",
    ]);
  });
});
