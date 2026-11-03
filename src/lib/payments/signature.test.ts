import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hmacSha256Hex, safeEqualHex, verifyCheckoutSignature, verifyWebhookSignature } from "./signature";

describe("signatures", () => {
  it("matches Node's HMAC (Razorpay docs algorithm)", async () => {
    const expected = createHmac("sha256", "secret").update("order_1|pay_1").digest("hex");
    expect(await hmacSha256Hex("secret", "order_1|pay_1")).toBe(expected);
    expect(await verifyCheckoutSignature("secret", "order_1", "pay_1", expected)).toBe(true);
    expect(await verifyCheckoutSignature("secret", "order_1", "pay_2", expected)).toBe(false);
    expect(await verifyCheckoutSignature("other", "order_1", "pay_1", expected)).toBe(false);
  });

  it("verifies webhooks against the exact raw body", async () => {
    const body = '{"event":"payment.captured"}';
    const sig = createHmac("sha256", "whsec").update(body).digest("hex");
    expect(await verifyWebhookSignature("whsec", body, sig)).toBe(true);
    expect(await verifyWebhookSignature("whsec", body + " ", sig)).toBe(false);
    expect(await verifyWebhookSignature("whsec", body, null)).toBe(false);
  });

  it("safeEqualHex rejects junk", () => {
    expect(safeEqualHex("abc", "abcd")).toBe(false);
    expect(safeEqualHex("zz", "zz")).toBe(false);
  });
});
