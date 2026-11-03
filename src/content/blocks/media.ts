/** Public URL for an image source stored in a block. */
export function mediaUrl(src: string, supabaseUrl?: string): string {
  if (src.startsWith("course-media/")) {
    const base = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    return `${base}/storage/v1/object/public/${src}`;
  }
  return src;
}

/** Convert a provider URL into an embeddable player URL. */
export function videoEmbedUrl(provider: "youtube" | "bunny" | "cloudflare_stream", url: string): string {
  if (provider !== "youtube") return url;
  const u = new URL(url);
  let id: string | null = null;
  if (u.hostname === "youtu.be") id = u.pathname.slice(1);
  else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] ?? null;
  else id = u.searchParams.get("v");
  return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0` : url;
}
