/** HMAC-SHA256 helpers on Web Crypto (Node, Vercel and Cloudflare Workers alike). */
const enc = new TextEncoder();

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two hex strings. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || !/^[0-9a-f]*$/i.test(a) || !/^[0-9a-f]*$/i.test(b)) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Razorpay Checkout success signature: HMAC(order_id + "|" + payment_id, key_secret). */
export async function verifyCheckoutSignature(secret: string, orderId: string, paymentId: string, signature: string) {
  return safeEqualHex(await hmacSha256Hex(secret, `${orderId}|${paymentId}`), signature);
}

/** Razorpay webhook signature: HMAC(raw body, webhook_secret) in X-Razorpay-Signature. */
export async function verifyWebhookSignature(secret: string, rawBody: string, signature: string | null) {
  if (!signature) return false;
  return safeEqualHex(await hmacSha256Hex(secret, rawBody), signature);
}
