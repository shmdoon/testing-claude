import { NextResponse, type NextRequest } from "next/server";
import { verifyLink } from "@/lib/links";
import { invoiceSignedUrl } from "@/lib/payments/service";

/** Invoice download from a signed link sent on WhatsApp (valid 30 days) → 60-second storage URL. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/invoices/link/[token]">) {
  const { token } = await ctx.params;
  const id = await verifyLink("invoice", token);
  if (!id) return new NextResponse("This link has expired. Ask us on WhatsApp for a new one.", { status: 404 });
  return NextResponse.redirect(await invoiceSignedUrl(id), { status: 303, headers: { "cache-control": "no-store" } });
}
