import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicEnv } from "@/lib/env";
import { heartbeatSchema, isSameOrigin, MAX_BODY_BYTES } from "@/lib/tracking/heartbeat";

/**
 * Active-time heartbeat. Always answers 204 (nothing to leak); bad input is
 * simply not counted. The 25 s rate limit and the 30 s / elapsed-time cap are
 * enforced atomically in `record_heartbeat`.
 */
export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });

  if (!isSameOrigin(request.headers.get("origin"), request.headers.get("referer"), request.headers.get("host"), getPublicEnv().NEXT_PUBLIC_SITE_URL)) {
    return done;
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return done;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return done;
  }
  const parsed = heartbeatSchema.safeParse(json);
  if (!parsed.success) return done;

  // The user comes from the session, never the payload.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return done;

  const b = parsed.data;
  const { error } = await createAdminClient().rpc("record_heartbeat", {
    p_user_id: userId,
    p_course_id: b.course_id,
    // Nullable in SQL; the generated type doesn't model that.
    p_lesson_id: b.lesson_id as string,
    p_seconds: b.seconds,
    p_flush: b.flush,
  });
  if (error) console.error("heartbeat failed", error.message);
  return done;
}
