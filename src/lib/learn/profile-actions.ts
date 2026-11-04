"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea, requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { echoOnError, type FormValues } from "@/lib/forms";

export type SimpleState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string>; values?: FormValues };
const uuid = z.uuid();

/** Students edit their own name (column grant + RLS). */
export async function updateMyName(_prev: SimpleState, form: FormData): Promise<SimpleState> {
  return echoOnError<SimpleState>(form, async () => {
    const user = await requireUser();
    const r = z.string().trim().min(1, "Please fill this in.").max(120).safeParse(form.get("full_name") ?? "");
    if (!r.success) return { fieldErrors: { full_name: r.error.issues[0]!.message } };
    const { error } = await (await createClient()).from("profiles").update({ full_name: r.data }).eq("id", user.id);
    if (error) return { error: "Couldn't save." };
    revalidatePath("/learn", "layout");
    return { ok: true, message: "Saved." };
  });
}

/** A student shows/hides one of their own approved projects in the gallery. */
export async function setMyGalleryShare(submissionId: string, share: boolean): Promise<SimpleState> {
  const user = await requireArea("learn");
  if (!uuid.safeParse(submissionId).success) return { error: "Invalid." };
  const { data, error } = await createAdminClient()
    .from("external_submissions")
    .update({ share_in_gallery: share })
    .eq("id", submissionId)
    .eq("user_id", user.id)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't update." };
  revalidatePath("/learn/profile");
  return { ok: true };
}
