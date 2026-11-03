import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { PaymentError, verifyAndFulfil, verifySchema } from "@/lib/payments/service";
import { rateLimit } from "@/lib/security/rate-limit";

/** Called by the browser after Razorpay Checkout succeeds. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  if (!(await rateLimit(`pay:verify:${user.id}`, 20, 60))) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });

  const parsed = verifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const r = await verifyAndFulfil(user.id, parsed.data);
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof PaymentError ? e.message : "Something went wrong.";
    if (!(e instanceof PaymentError)) console.error("verify failed", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
