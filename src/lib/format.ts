const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** 49900 → "₹499" */
export function formatInr(paise: number): string {
  return inr.format(paise / 100);
}
