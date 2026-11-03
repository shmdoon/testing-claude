import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

/**
 * Service-role client: BYPASSES RLS. Only for trusted server code (webhooks,
 * invoice generation, admin actions after `requireRole`). Never import from
 * client components — `server-only` makes that a build error.
 */
export function createAdminClient() {
  const env = getServerEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
