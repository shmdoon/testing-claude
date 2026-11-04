import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env.server";
import { safeEqualHex } from "@/lib/payments/signature";
import { sendWeeklySummaries } from "@/lib/whatsapp/weekly";

/**
 * Scheduled weekly WhatsApp summary. Call with `Authorization: Bearer $CRON_SECRET`
 * (Vercel Cron sends this automatically; on Cloudflare use a Cron Trigger worker).
 */
async function handle(request: NextRequest) {
  const secret = getServerEnv().CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const hex = (s: string) => Buffer.from(s).toString("hex");
  if (!secret || !safeEqualHex(hex(given), hex(secret))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await sendWeeklySummaries());
}
export const GET = handle;
export const POST = handle;
