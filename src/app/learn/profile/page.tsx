import { PageHeader } from "@/components/layout/area-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { GalleryShareToggle, NameForm } from "@/components/dashboard/profile-forms";
import { requireArea } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile" };

const mask = (email: string | null) => (email ? email.replace(/^(.).*(@.*)$/, "$1•••$2") : "—");

export default async function ProfilePage() {
  const user = await requireArea("learn", "/learn/profile");
  const supabase = await createClient();
  const [{ data: me }, { data: projects }] = await Promise.all([
    supabase.from("profiles").select("full_name, class_level, parent_email, account_status").eq("id", user.id).single(),
    supabase
      .from("external_submissions")
      .select("id, kind, url, share_in_gallery, reviewed_at, lessons(title)")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false }),
  ]);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Your profile" />
      <Card>
        <NameForm name={me?.full_name ?? ""} />
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Class</dt>
            <dd className="font-semibold">{me?.class_level ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Parent or guardian</dt>
            <dd className="font-semibold">{mask(me?.parent_email ?? null)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Account</dt>
            <dd>
              <Badge variant={me?.account_status === "active" ? "success" : "warning"}>{me?.account_status === "active" ? "Approved" : "Waiting for approval"}</Badge>
            </dd>
          </div>
        </dl>
      </Card>
      <Card>
        <CardTitle>Your approved projects</CardTitle>
        {projects?.length ? (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.id} className="rounded-xl border p-3">
                <p className="font-semibold">{p.lessons?.title}</p>
                {p.url && <p className="text-sm break-all text-muted-foreground">{p.url}</p>}
                {(p.kind === "url" || p.kind === "screenshot") && <GalleryShareToggle submissionId={p.id} initial={p.share_in_gallery} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Projects your teacher approves will appear here.</p>
        )}
        <p className="text-sm text-muted-foreground">Projects only appear in the gallery if you choose to share them and your parent allows it.</p>
      </Card>
    </div>
  );
}
