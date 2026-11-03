/** Money helpers. All amounts are integer paise. */

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  return TENS[Math.floor(n / 10)]! + (n % 10 ? `-${ONES[n % 10]}` : "");
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? belowHundred(r) : ""].filter(Boolean).join(" ");
}

/** Indian numbering: 1,23,45,678 → "One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight". */
export function numberToIndianWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error("Expected a non-negative integer");
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  const lakh = Math.floor((n % 1e7) / 1e5);
  const thousand = Math.floor((n % 1e5) / 1e3);
  const rest = n % 1e3;
  if (crore) parts.push(`${numberToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

/** 49950 → "Rupees Four Hundred Ninety-Nine and Fifty Paise Only" */
export function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  return `Rupees ${numberToIndianWords(rupees)}${p ? ` and ${numberToIndianWords(p)} Paise` : ""} Only`;
}

/** 4991050 → "49,910.50" (Indian digit grouping, always 2 decimals). */
export function formatPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(paise / 100);
}

export type CouponLike = { kind: "percent" | "flat"; value: number };

/** Discount for a coupon, never more than the price. */
export function couponDiscount(listPaise: number, coupon: CouponLike | null): number {
  if (!coupon) return 0;
  const d = coupon.kind === "percent" ? Math.round((listPaise * coupon.value) / 100) : coupon.value;
  return Math.max(0, Math.min(listPaise, d));
}
