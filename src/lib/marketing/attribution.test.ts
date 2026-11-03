import { describe, expect, it } from "vitest";
import { attributionFromUrl, decodeAttribution, encodeAttribution } from "./attribution";

describe("attribution", () => {
  it("captures UTM + click id type + landing + external referrer", () => {
    const a = attributionFromUrl(
      new URL("https://hub.example/lp/ai-for-kids?utm_source=google&utm_medium=cpc&utm_campaign=summer&gclid=SECRET123"),
      "https://www.google.com/",
    );
    expect(a).toEqual({ utm_source: "google", utm_medium: "cpc", utm_campaign: "summer", click_id_type: "gclid", landing_path: "/lp/ai-for-kids", referrer_host: "www.google.com" });
    expect(JSON.stringify(a)).not.toContain("SECRET123"); // the click id value itself is never stored
  });
  it("ignores plain visits and same-site referrers", () => {
    expect(attributionFromUrl(new URL("https://hub.example/courses"), null)).toBeNull();
    expect(attributionFromUrl(new URL("https://hub.example/?utm_source=x"), "https://hub.example/a")?.referrer_host).toBeUndefined();
  });
  it("round-trips and rejects tampered cookies", () => {
    const a = { utm_source: "meta", utm_campaign: "diwali" };
    expect(decodeAttribution(encodeAttribution(a))).toEqual(a);
    expect(decodeAttribution("not-base64-json")).toBeNull();
    expect(decodeAttribution(Buffer.from(JSON.stringify({ utm_source: "x".repeat(500) })).toString("base64url"))).toBeNull();
  });
});
