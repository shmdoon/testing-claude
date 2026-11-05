import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/security/cron";
import { runCleanup } from "@/lib/privacy/service";

/** Daily housekeeping (data minimisation). `Authorization: Bearer $CRON_SECRET`. */
async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runCleanup());
}
export const GET = handle;
export const POST = handle;
