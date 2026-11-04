import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone, waLink } from "./phone";

describe("phone", () => {
  it.each([
    ["98765 43210", "+919876543210"],
    ["098765-43210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["+44 7700 900123", "+447700900123"],
    ["12345", null],
    ["5876543210", null],
    ["", null],
  ])("%s → %s", (a, b) => expect(normalizePhone(a)).toBe(b));
  it("masks", () => expect(maskPhone("+919876543210")).toBe("+91 98765 •••10"));
  it("builds wa.me links", () => expect(waLink("+919876543210", "Hi & bye")).toBe("https://wa.me/919876543210?text=Hi%20%26%20bye"));
});
