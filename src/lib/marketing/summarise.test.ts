import { describe, expect, it } from "vitest";
import { summarise } from "./admin-queries";

describe("lead summary", () => {
  it("groups by campaign/source/medium and counts opt-ins", () => {
    const rows = summarise([
      { utm_campaign: "summer", utm_source: "google", utm_medium: "cpc", marketing_consent: true },
      { utm_campaign: "summer", utm_source: "google", utm_medium: "cpc", marketing_consent: false },
      { utm_campaign: null, utm_source: null, utm_medium: null, marketing_consent: true },
    ]);
    expect(rows).toEqual([
      { campaign: "summer", source: "google", medium: "cpc", leads: 2, optedIn: 1 },
      { campaign: "(none)", source: "(direct)", medium: "—", leads: 1, optedIn: 1 },
    ]);
  });
});
