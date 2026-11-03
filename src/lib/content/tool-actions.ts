"use server";

import { echoOnError } from "@/lib/forms";
import { updateTag } from "next/cache";
import { requireArea } from "@/lib/auth/dal";
import { writeAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { toolFormFromData } from "@/lib/validation/tools";
import { CATALOG_TAG } from "./tags";
import type { ActionState } from "./studio-actions";

export async function saveTool(toolId: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return echoOnError<ActionState>(form, async () => {
    const user = await requireArea("admin");
    const parsed = toolFormFromData(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
      return { fieldErrors };
    }
    const supabase = await createClient();
    const { data, error } = toolId
      ? await supabase.from("external_tools").update(parsed.data).eq("id", toolId).select("id").single()
      : await supabase.from("external_tools").insert(parsed.data).select("id").single();
    if (error) {
      if (error.code === "23505") return { fieldErrors: { slug: "That slug is already used." } };
      console.error("tool save failed", error);
      return { error: "Could not save the tool." };
    }
    await writeAudit({
      actorId: user.id,
      action: toolId ? "tool.updated" : "tool.created",
      targetType: "external_tool",
      targetId: data.id,
      metadata: { slug: parsed.data.slug, enabled: parsed.data.enabled, min_age: parsed.data.min_age },
    });
    updateTag(CATALOG_TAG);
    return { ok: true, message: toolId ? "Tool updated." : "Tool added." };
  });
}
