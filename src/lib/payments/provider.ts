import "server-only";
import { randomUUID } from "node:crypto";
import { getServerEnv } from "@/lib/env.server";
import { hmacSha256Hex, verifyCheckoutSignature, verifyWebhookSignature } from "./signature";

/**
 * Payment gateway abstraction. `razorpay` talks to the real REST API (fetch,
 * no SDK → works on any host). `mock` behaves like Razorpay test mode for
 * local development and automated tests: same signatures, same webhook
 * payloads, same fulfilment code. It is only available on localhost or with
 * PAYMENTS_ALLOW_MOCK=true, and its invoices use a separate TEST series.
 */
export type PaymentsMode = "razorpay" | "mock" | "disabled";

export type GatewayPayment = {
  id: string;
  order_id: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amount: number;
  method?: string;
};

export interface PaymentProvider {
  mode: Exclude<PaymentsMode, "disabled">;
  /** Public key id for Checkout (safe for the browser). */
  keyId: string;
  createOrder(input: { amount: number; receipt: string; notes: Record<string, string> }): Promise<{ id: string }>;
  fetchPayment(paymentId: string): Promise<GatewayPayment>;
  refund(paymentId: string, amount: number, notes: Record<string, string>): Promise<{ id: string; status: string }>;
  verifyCheckout(orderId: string, paymentId: string, signature: string): Promise<boolean>;
  verifyWebhook(rawBody: string, signature: string | null): Promise<boolean>;
}

export const MOCK_KEY_ID = "rzp_mock_local";
export const MOCK_KEY_SECRET = "mock_key_secret_local_only";
export const MOCK_WEBHOOK_SECRET = "mock_webhook_secret_local_only";

export function paymentsMode(): PaymentsMode {
  const env = getServerEnv();
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET) return "razorpay";
  const host = new URL(env.NEXT_PUBLIC_SITE_URL).hostname;
  if (host === "localhost" || host === "127.0.0.1" || env.PAYMENTS_ALLOW_MOCK) return "mock";
  return "disabled";
}

export function getProvider(): PaymentProvider | null {
  const mode = paymentsMode();
  if (mode === "razorpay") return razorpay();
  if (mode === "mock") return mock();
  return null;
}

// ---------------------------------------------------------------------------
function razorpay(): PaymentProvider {
  const env = getServerEnv();
  const keyId = env.RAZORPAY_KEY_ID!;
  const secret = env.RAZORPAY_KEY_SECRET!;
  const auth = `Basic ${btoa(`${keyId}:${secret}`)}`;
  async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: init?.method ?? "GET",
      headers: { authorization: auth, "content-type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
    if (!res.ok) throw new Error(`Razorpay ${path} failed (${res.status}): ${json.error?.description ?? "unknown error"}`);
    return json;
  }
  return {
    mode: "razorpay",
    keyId,
    createOrder: ({ amount, receipt, notes }) =>
      call<{ id: string }>("/orders", { method: "POST", body: { amount, currency: "INR", receipt, notes } }),
    fetchPayment: (id) => call<GatewayPayment>(`/payments/${encodeURIComponent(id)}`),
    refund: (paymentId, amount, notes) =>
      call<{ id: string; status: string }>(`/payments/${encodeURIComponent(paymentId)}/refund`, { method: "POST", body: { amount, notes, speed: "normal" } }),
    verifyCheckout: (o, p, s) => verifyCheckoutSignature(secret, o, p, s),
    verifyWebhook: (raw, sig) => verifyWebhookSignature(env.RAZORPAY_WEBHOOK_SECRET!, raw, sig),
  };
}

// ---------------------------------------------------------------------------
// Mock gateway. Payment ids encode order + amount so fetchPayment is stateless.
const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const dec = <T>(s: string): T => JSON.parse(Buffer.from(s, "base64url").toString()) as T;

export function mockPaymentId(orderId: string, amount: number, status: "captured" | "failed") {
  return `pay_mock_${enc({ o: orderId, a: amount, s: status, n: randomUUID().slice(0, 8) })}`;
}

function mock(): PaymentProvider {
  return {
    mode: "mock",
    keyId: MOCK_KEY_ID,
    createOrder: async () => ({ id: `order_mock_${randomUUID().replaceAll("-", "").slice(0, 14)}` }),
    fetchPayment: async (id) => {
      if (!id.startsWith("pay_mock_")) throw new Error("Unknown mock payment");
      const p = dec<{ o: string; a: number; s: "captured" | "failed" }>(id.slice("pay_mock_".length));
      return { id, order_id: p.o, status: p.s, amount: p.a, method: "mock" };
    },
    refund: async () => ({ id: `rfnd_mock_${randomUUID().replaceAll("-", "").slice(0, 14)}`, status: "processed" }),
    verifyCheckout: (o, p, s) => verifyCheckoutSignature(MOCK_KEY_SECRET, o, p, s),
    verifyWebhook: (raw, sig) => verifyWebhookSignature(MOCK_WEBHOOK_SECRET, raw, sig),
  };
}

/** Mock helpers that play the gateway's part (sign like Razorpay would). */
export const mockGateway = {
  checkoutSignature: (orderId: string, paymentId: string) => hmacSha256Hex(MOCK_KEY_SECRET, `${orderId}|${paymentId}`),
  webhookSignature: (raw: string) => hmacSha256Hex(MOCK_WEBHOOK_SECRET, raw),
};
