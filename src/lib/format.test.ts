import { describe, expect, it } from "vitest";
import { formatInr } from "./format";

describe("formatInr", () => {
  it.each([
    [49900, "₹499"],
    [44910, "₹449.10"],
    [5, "₹0.05"],
    [12345600, "₹1,23,456"],
  ])("%d → %s", (p, s) => expect(formatInr(p)).toBe(s));
});
