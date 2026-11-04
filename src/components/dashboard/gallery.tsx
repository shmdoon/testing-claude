import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/** Approved projects shared by students AND allowed by a parent — first names only. Members only. */
export async function Gallery() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gallery_items", { p_limit: 60 });
  if (error) return <p className="text-muted-foreground">The gallery is available once your account is active.</p>;
  if (!data?.length) return <p className="rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground">No projects in the gallery yet.</p>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((g) => (
        <li key={g.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm" data-testid="gallery-item">
          {g.has_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/gallery/${g.id}`} alt={`Project by ${g.first_name}`} loading="lazy" className="aspect-video w-full bg-muted object-cover" />
          ) : (
            <div className="grid aspect-video place-items-center bg-secondary text-secondary-foreground">
              <ExternalLink className="size-8" aria-hidden />
            </div>
          )}
          <div className="space-y-1 p-4">
            <p className="font-bold">
              {g.first_name} · Class {g.class_level ?? "?"}
            </p>
            <p className="text-sm text-muted-foreground">
              {g.lesson_title} · {g.course_title}
            </p>
            {g.url && (
              <a href={g.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline">
                Open project <ExternalLink className="size-4" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
