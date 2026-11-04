/** Phone helpers (mirror of private.normalize_phone in SQL). Default country: India (+91). */
export function normalizePhone(input: string | null | undefined): string | null {
  const raw = (input ?? "").replace(/[^0-9+]/g, "");
  if (/^\+[1-9][0-9]{7,14}$/.test(raw)) return raw;
  const d = raw.replace(/\D/g, "");
  if (/^0?[6-9][0-9]{9}$/.test(d)) return `+91${d.slice(-10)}`;
  if (/^91[6-9][0-9]{9}$/.test(d)) return `+${d}`;
  return null;
}

/** +919876543210 → "+91 98765 •••10" (for screens the child can see). */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  return `${e164.slice(0, e164.length - 10)} ${e164.slice(-10, -5)} •••${e164.slice(-2)}`;
}

/** WhatsApp click-to-chat link with a prefilled message (manual sending). */
export function waLink(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
