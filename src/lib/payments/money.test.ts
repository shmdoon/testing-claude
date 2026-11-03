import { describe, expect, it } from "vitest";
import { amountInWords, couponDiscount, formatPaise, numberToIndianWords } from "./money";

describe("numberToIndianWords", () => {
  it.each([
    [0, "Zero"],
    [7, "Seven"],
    [19, "Nineteen"],
    [21, "Twenty-One"],
    [100, "One Hundred"],
    [499, "Four Hundred Ninety-Nine"],
    [1000, "One Thousand"],
    [12345, "Twelve Thousand Three Hundred Forty-Five"],
    [100000, "One Lakh"],
    [12345678, "One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight"],
    [1000000000, "One Hundred Crore"],
  ])("%d → %s", (n, words) => expect(numberToIndianWords(n)).toBe(words));
});

describe("amountInWords", () => {
  it("includes paise", () => expect(amountInWords(49950)).toBe("Rupees Four Hundred Ninety-Nine and Fifty Paise Only"));
  it("whole rupees", () => expect(amountInWords(44910)).toBe("Rupees Four Hundred Forty-Nine and Ten Paise Only"));
  it("zero", () => expect(amountInWords(0)).toBe("Rupees Zero Only"));
});

describe("money", () => {
  it("formats with Indian grouping", () => expect(formatPaise(12345678)).toBe("1,23,456.78"));
  it("coupon discounts are clamped", () => {
    expect(couponDiscount(49900, { kind: "percent", value: 10 })).toBe(4990);
    expect(couponDiscount(49900, { kind: "flat", value: 100000 })).toBe(49900);
    expect(couponDiscount(49900, { kind: "percent", value: 100 })).toBe(49900);
    expect(couponDiscount(49900, null)).toBe(0);
  });
});
