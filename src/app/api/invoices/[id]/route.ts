import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { invoiceSignedUrl } from "@/lib/payments/service";

/** Invoice/credit-note download: RLS decides access (buyer or admin), then a 60-second signed URL. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/invoices/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in", { status: 401 });
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("id").eq("id", id).maybeSingle();
  if (!data) return new NextResponse("Not found", { status: 404 });
  const url = await invoiceSignedUrl(id);
  return NextResponse.redirect(url, { status: 303, headers: { "cache-control": "no-store" } });
}
