import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Gallery screenshot, re-served by the app (never a public bucket URL) only if it's gallery-eligible for this member. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/gallery/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });
  const { data: items } = await (await createClient()).rpc("gallery_items", { p_limit: 200 });
  if (!items?.some((g) => g.id === id && g.has_image)) return new NextResponse(null, { status: 404 });
  const admin = createAdminClient();
  const { data: sub } = await admin.from("external_submissions").select("storage_path").eq("id", id).single();
  if (!sub?.storage_path) return new NextResponse(null, { status: 404 });
  const { data: blob } = await admin.storage.from(process.env.SUPABASE_SUBMISSIONS_BUCKET || "submissions").download(sub.storage_path);
  if (!blob) return new NextResponse(null, { status: 404 });
  return new NextResponse(blob, {
    headers: { "content-type": blob.type || "image/png", "cache-control": "private, max-age=300", "x-content-type-options": "nosniff", "content-disposition": "inline" },
  });
}
