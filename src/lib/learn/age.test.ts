import { describe, expect, it } from "vitest";
import { canUseTool, capAwaySeconds, estimatedAge } from "./age";

describe("tool eligibility", () => {
  const netlify = { enabled: true, min_age: 13 };
  it("estimates age from class", () => expect(estimatedAge(7)).toBe(12));
  it("Class 7 (≈12) can't use a 13+ tool; Class 8 (≈13) can", () => {
    expect(canUseTool(netlify, "student", 7)).toBe(false);
    expect(canUseTool(netlify, "student", 8)).toBe(true);
  });
  it("disabled tools are off for everyone", () => {
    expect(canUseTool({ enabled: false, min_age: 0 }, "admin", null)).toBe(false);
  });
  it("students without a class are never eligible; staff preview", () => {
    expect(canUseTool(netlify, "student", null)).toBe(false);
    expect(canUseTool(netlify, "content_editor", null)).toBe(true);
  });
  it("caps away time at 2× estimate", () => {
    expect(capAwaySeconds(10_000, 20)).toBe(2400);
    expect(capAwaySeconds(-5, 20)).toBe(0);
    expect(capAwaySeconds(Number.NaN, 20)).toBe(0);
    expect(capAwaySeconds(61.4, 20)).toBe(61);
  });
});
