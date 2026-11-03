import { describe, expect, it } from "vitest";
import { istWeekStart } from "./queries";

describe("istWeekStart", () => {
  it("uses Monday in India time", () => {
    expect(istWeekStart(new Date("2026-11-04T10:00:00Z"))).toBe("2026-11-02"); // Wed → Mon
    expect(istWeekStart(new Date("2026-11-08T19:00:00Z"))).toBe("2026-11-09"); // Sun 19:00 UTC = Mon 00:30 IST
    expect(istWeekStart(new Date("2026-11-02T00:00:00Z"))).toBe("2026-11-02"); // Monday
  });
});
