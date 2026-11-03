import { NextResponse, type NextRequest } from "next/server";
import { handleWebhook } from "@/lib/payments/service";

/**
 * Razorpay webhook — the source of truth for payments and refunds.
 * Signature is checked against the exact raw body; events are idempotent.
 * (Excluded from the auth proxy matcher.)
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 256 * 1024) return NextResponse.json({ ok: false }, { status: 413 });
  const { status, result } = await handleWebhook(raw, request.headers.get("x-razorpay-signature"), request.headers.get("x-razorpay-event-id"));
  return NextResponse.json({ result }, { status });
}
