import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReviewActions } from "./review-card";

type Filters = { status: "submitted" | "approved" | "needs_revision"; course?: string };

/**
 * Teacher review queue. The caller MUST have passed requireArea("studio"|"admin").
 * Uses the service role only to show minimal student info (first name + class)
 * and to sign 5-minute preview URLs for private uploads.
 */
export async function ReviewQueue({ basePath, filters }: { basePath: string; filters: Filters }) {
  const admin = createAdminClient();
  let q = admin
    .from("external_submissions")
    .select("id, kind, url, text_answer, storage_path, url_check, status, feedback, share_in_gallery, created_at, block_id, profiles!external_submissions_user_id_fkey(full_name, class_level), lessons(title), courses(id, title), external_tools(name)")
    .eq("status", filters.status)
    .order("created_at", { ascending: filters.status === "submitted" })
    .limit(100);
  if (filters.course) q = q.eq("course_id", filters.course);
  const [{ data: subs }, { data: courses }] = await Promise.all([q, admin.from("courses").select("id, title").order("title")]);

  const paths = (subs ?? []).map((s) => s.storage_path).filter(Boolean) as string[];
  const signed = paths.length ? (await admin.storage.from(process.env.SUPABASE_SUBMISSIONS_BUCKET || "submissions").createSignedUrls(paths, 300)).data ?? [] : [];
  const url = new Map(signed.map((s) => [s.path, s.signedUrl]));
  const select = "h-11 rounded-lg border-2 border-input bg-background px-3 block";

  return (
    <div className="space-y-5">
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Status</span>
          <select name="status" defaultValue={filters.status} className={select} key={filters.status}>
            <option value="submitted">Waiting for review</option>
            <option value="needs_revision">Sent back</option>
            <option value="approved">Approved</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Course</span>
          <select name="course" defaultValue={filters.course ?? ""} className={select} key={filters.course ?? ""}>
            <option value="">All courses</option>
            {(courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Filter</Button>
      </form>

      {!subs?.length ? (
        <p className="rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="space-y-4">
          {subs.map((s) => {
            const first = (s.profiles?.full_name ?? "Student").split(" ")[0];
            const check = s.url_check as { status?: string; reason?: string; httpStatus?: number } | null;
            const preview = s.storage_path ? url.get(s.storage_path) : undefined;
            return (
              <li key={s.id} className="grid gap-4 rounded-2xl border bg-card p-4 md:grid-cols-[1fr_320px]" data-testid="review-item">
                <div className="space-y-2">
                  <p className="flex flex-wrap items-center gap-2">
                    <strong>
                      {first} · Class {s.profiles?.class_level ?? "?"}
                    </strong>
                    <Badge variant="outline">{s.kind}</Badge>
                    {s.external_tools?.name && <Badge variant="outline">{s.external_tools.name}</Badge>}
                    {s.share_in_gallery && <Badge variant="accent">wants gallery</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {s.lessons?.title} · {s.courses?.title} · {new Date(s.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                  </p>
                  {s.kind === "url" && s.url && (
                    <p className="text-sm">
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-semibold break-all text-primary underline">
                        {s.url} <ExternalLink className="size-4" aria-hidden />
                      </a>{" "}
                      <Badge variant={check?.status === "live" ? "success" : "warning"}>{check?.status === "live" ? `live (${check.httpStatus})` : `not reachable: ${check?.reason ?? "unknown"}`}</Badge>
                    </p>
                  )}
                  {s.text_answer && <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{s.text_answer}</p>}
                  {preview && s.kind === "screenshot" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt={`Screenshot submitted by ${first}`} className="max-h-72 rounded-lg border" />
                  )}
                  {preview && s.kind === "file" && (
                    <a href={preview} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
                      Open file (link valid 5 minutes)
                    </a>
                  )}
                  {s.feedback && <p className="text-sm text-muted-foreground">Feedback: “{s.feedback}”</p>}
                </div>
                <ReviewActions id={s.id} status={s.status} shared={s.share_in_gallery} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function parseReviewFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const status = one(sp.status);
  const course = one(sp.course);
  return {
    status: status === "approved" || status === "needs_revision" ? status : "submitted",
    course: course && /^[0-9a-f-]{36}$/.test(course) ? course : undefined,
  };
}
