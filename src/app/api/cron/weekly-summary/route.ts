import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/security/cron";
import { sendWeeklySummaries } from "@/lib/whatsapp/weekly";

/**
 * Scheduled weekly WhatsApp summary. Call with `Authorization: Bearer $CRON_SECRET`
 * (Vercel Cron sends this automatically; on Cloudflare use a Cron Trigger worker).
 */
async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await sendWeeklySummaries());
}
export const GET = handle;
export const POST = handle;
