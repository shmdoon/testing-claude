import "server-only";
import type { NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env.server";
import { safeEqualHex } from "@/lib/payments/signature";

/** Scheduled jobs authenticate with `Authorization: Bearer $CRON_SECRET` (constant-time compare). */
export function isCronAuthorized(request: NextRequest): boolean {
  const secret = getServerEnv().CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const hex = (s: string) => Buffer.from(s).toString("hex");
  return Boolean(secret) && safeEqualHex(hex(given), hex(secret!));
}
