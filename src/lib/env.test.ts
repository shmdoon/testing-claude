import { describe, expect, it } from "vitest";
import { parseEnv, publicSchema, serverSchema } from "./env";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
};

describe("parseEnv", () => {
  it("applies defaults", () => {
    expect(parseEnv(publicSchema, base).NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("treats empty strings as missing and lists every problem", () => {
    expect(() => parseEnv(serverSchema, { ...base, NEXT_PUBLIC_SUPABASE_URL: "" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL[\s\S]*SUPABASE_SECRET_KEY/,
    );
  });

  it("rejects invalid URLs", () => {
    expect(() => parseEnv(publicSchema, { ...base, NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow();
  });

  it("parses booleans", () => {
    const env = parseEnv(serverSchema, { ...base, SUPABASE_SECRET_KEY: "s", AUTH_GOOGLE_ENABLED: "true" });
    expect(env.AUTH_GOOGLE_ENABLED).toBe(true);
  });
});
