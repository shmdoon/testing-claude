import { describe, expect, it } from "vitest";
import { toolFormSchema } from "./tools";

const base = {
  slug: "netlify",
  name: "Netlify",
  description: "",
  base_url: "https://app.netlify.com/drop",
  logo_url: "",
  submission_domains: "*.netlify.app, example.org",
  min_age: "13",
  requires_account: false,
  enabled: true,
};

describe("toolFormSchema", () => {
  it("parses domains and nulls", () => {
    expect(toolFormSchema.parse(base)).toMatchObject({
      submission_domains: ["*.netlify.app", "example.org"],
      logo_url: null,
      description: null,
      min_age: 13,
    });
  });
  it("requires https", () => {
    expect(toolFormSchema.safeParse({ ...base, base_url: "http://x.com" }).success).toBe(false);
    expect(toolFormSchema.safeParse({ ...base, logo_url: "javascript:alert(1)" }).success).toBe(false);
  });
  it("rejects wildcard abuse and IPs", () => {
    for (const d of ["*", "*.com", "10.0.0.1", "*.*.app", "evil.com/x"]) {
      expect(toolFormSchema.safeParse({ ...base, submission_domains: d }).success, d).toBe(false);
    }
  });
});
