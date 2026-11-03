import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Append to audit_log. Uses the service role because clients have no insert
 * grant on the table; callers must have already passed a server-side role check.
 */
export async function writeAudit(entry: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, Json>;
}) {
  const { error } = await createAdminClient()
    .from("audit_log")
    .insert({
      actor_id: entry.actorId,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
    });
  if (error) console.error("audit write failed", entry.action, error.message);
}
