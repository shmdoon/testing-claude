import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { getPaymentRequest, PaymentError, verifyAndFulfil, verifySchema, type OrderAuth } from "@/lib/payments/service";
import { getClientIp, rateLimit } from "@/lib/security/rate-limit";

/** Called by the browser after Razorpay Checkout succeeds (in-app or via a WhatsApp payment link). */
export async function POST(request: NextRequest) {
  if (!(await rateLimit(`pay:verify:${await getClientIp()}`, 30, 60))) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  const parsed = verifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  let auth: OrderAuth | null = null;
  if (parsed.data.pay_token) {
    const req = await getPaymentRequest(parsed.data.pay_token);
    if (req) auth = { paymentRequestId: req.id };
  } else {
    const user = await getCurrentUser();
    if (user) auth = { userId: user.id };
  }
  if (!auth) return NextResponse.json({ error: "Sign in again." }, { status: 401 });

  try {
    return NextResponse.json(await verifyAndFulfil(auth, parsed.data));
  } catch (e) {
    if (!(e instanceof PaymentError)) console.error("verify failed", e);
    return NextResponse.json({ error: e instanceof PaymentError ? e.message : "Something went wrong." }, { status: 400 });
  }
}
